import struct
import threading

import serial
from serial.tools import list_ports


class NucleoInterface:
    """
    A class to communicate with a Nucleo board over a serial connection.
    Automatically detects the Nucleo's COM port and provides methods to send commands.
    """

    SERVO_TIMINGS: dict[int, tuple[int, int]] = {
        0: (100, 470),
        1: (100, 470),
    }

    def __init__(self, baud_rate: int = 115_200, timeout: float = 0.01):
        self.baud_rate = baud_rate
        self.timeout = timeout
        self.serial_port = None
        self.lock = threading.Lock()
        self.connect()

    def connect(self) -> None:
        "Attempts to find the Nucleo board's COM port and establish a serial connection."
        port_name = self.find_nucleo_port()
        if port_name:
            self.serial_port = serial.Serial(port_name, self.baud_rate, timeout=self.timeout)
        else:
            raise ConnectionError("Could not find Nucleo board. Please ensure it is connected.")

    @staticmethod
    def find_nucleo_port():
        "Scans available COM ports to find the one connected to the Nucleo board."
        ports = list_ports.comports()
        for port in ports:
            if (
                "STM" in port.description
                or "Nucleo" in port.description
                or (port.manufacturer and "STMicroelectronics" in port.manufacturer)
            ):
                return port.device
        return None

    @staticmethod
    def map_range(
        value: float | int,
        input_min: float | int,
        input_max: float | int,
        output_min: float | int,
        output_max: float | int,
    ) -> float:
        "Maps a value from one range to another and clamps it within the output range."
        # Calculate the proportion of 'value' within the input range
        proportion = (value - input_min) / (input_max - input_min)

        # Map the proportion to the output range
        mapped_value = output_min + proportion * (output_max - output_min)

        # Clamp the mapped value to the output range
        clamped_value = max(min(mapped_value, output_max), output_min)

        return clamped_value

    def close(self) -> None:
        "Stops all motors and closes the serial connection."
        if self.serial_port and self.serial_port.is_open:
            # Stop all motors before closing
            self.stop_all_steppers()
            self.serial_port.close()

    def send_command(self, command_byte: str, data_bytes: bytes = b"") -> None:
        "Sends a command to the Nucleo board."
        assert self.serial_port is not None, "Must initialize serial!"
        assert len(command_byte) == 1, "Command must be a single character."
        with self.lock:
            header = b"M"
            command = command_byte.encode("ascii")
            self.serial_port.write(header + command + data_bytes)

    def receive_data(self, num_bytes: int) -> bytes:
        "Receives a specified number of bytes from the Nucleo board."
        assert self.serial_port is not None, "Must initialize serial!"
        with self.lock:
            data = self.serial_port.read(num_bytes)
        return data

    def set_servo_pwm(self, channel: int, on_time: int, off_time: int) -> None:
        "Sends a command to set a servo position."
        if not (0 <= channel <= 15):
            raise ValueError("Channel must be between 0 and 15.")
        if not (0 <= on_time <= 4095) or not (0 <= off_time <= 4095):
            raise ValueError("On time and off time must be between 0 and 4095.")
        data = struct.pack("<BHH", channel, on_time, off_time)
        self.send_command("s", data)

    def set_servo_angle(self, channel: int, angle: float) -> None:
        if not (timing := self.SERVO_TIMINGS.get(channel)):
            raise ValueError(f"Unknown timings for channel {channel}!")
        off_time = self.map_range(angle, 0, 360, *timing)
        return self.set_servo_pwm(channel, 0, round(off_time))

    def read_angles(self) -> tuple[int, int, int]:
        "Sends a command to read angles from the Nucleo board. Returns a tuple of three angles."
        self.send_command("a")
        data = self.receive_data(12)
        if len(data) != 12:
            raise IOError(f"Failed to receive angle data. Received: {data}")
        angles = struct.unpack("<iii", data)
        return tuple(angle / 4096 * 360 for angle in angles)  # type: ignore

    def set_wheel_speeds(self, speeds: tuple[int, int, int]) -> None:
        "Sends a command to set wheel speeds."
        data = struct.pack("<iii", *speeds)
        self.send_command("u", data)

    def stop_all_steppers(self) -> None:
        "Sends a command to stop all stepper motors."
        self.send_command("x")

    def ping(self) -> bool:
        "Sends a ping command and waits for a 'pong' response. Returns True if 'pong' is received, False otherwise."
        self.send_command("p")
        data = self.receive_data(4)
        if data == b"pong":
            return True
        else:
            return False

    def set_inverse_kinematics(self, x_dot: float, y_dot: float, theta_dot: float) -> None:
        "Sends a command to set wheel velocities via inverse kinematics."
        data = struct.pack("<ddd", x_dot, y_dot, theta_dot)
        self.send_command("k", data)

    def __enter__(self):
        "Allows use of the class as a context manager."
        return self

    def __exit__(self, *_) -> None:
        "Ensures the serial connection is closed when exiting a context."
        self.close()
