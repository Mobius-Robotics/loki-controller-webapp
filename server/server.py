import asyncio

import websockets
from pydantic import BaseModel, Field

from nucleo_interface import NucleoInterface

# WebSocket server settings
HOST = "localhost"
PORT = 5743

# Create an instance of NucleoInterface
nucleo = NucleoInterface()

# Configurable speed limits
LINEAR_SPEED_LIMIT = 1000
ANGULAR_SPEED_LIMIT = 10000

# Configurable channel settings
ELEVATOR_CHANNEL = 0
CLAW_CHANNEL = 1


def cubic_easing(value):
    """Applies cubic easing to the input value."""
    return value**3


class JoystickData(BaseModel):
    x: float = Field(0.0)
    y: float = Field(0.0)


class SliderData(BaseModel):
    elevator_position: float = Field(0.0, alias="Elevator")
    claw_position: float = Field(0.0, alias="Claw")
    omega: float = Field(0.0, alias="ω")


class ClientData(BaseModel):
    joystick: JoystickData = Field(default_factory=JoystickData)
    sliders: SliderData = Field(default_factory=SliderData)


connected_client = None


async def handle_connection(websocket, path):
    global connected_client
    if connected_client is not None:
        await websocket.close(reason="Another client is already connected.")
        return

    connected_client = websocket
    print(f"Client connected: {path}")
    try:
        async for message in websocket:
            # Parse the incoming message from the client using Pydantic
            data = ClientData.model_validate_json(message)

            # Retrieve individual components of joystick values
            joystick_x = data.joystick.x
            joystick_y = data.joystick.y

            # Apply cubic easing to joystick values
            eased_joystick_x = cubic_easing(joystick_x)
            eased_joystick_y = cubic_easing(joystick_y)

            # Scale the eased joystick values to the configured linear speed limits
            x_dot = eased_joystick_x * LINEAR_SPEED_LIMIT
            y_dot = eased_joystick_y * LINEAR_SPEED_LIMIT

            # Retrieve and apply cubic easing to omega value
            raw_theta_dot = data.sliders.omega
            eased_theta_dot = cubic_easing(raw_theta_dot)

            # Scale the eased omega value to the configured angular speed limit
            theta_dot = eased_theta_dot * ANGULAR_SPEED_LIMIT

            # Send the velocity commands to the Nucleo board
            nucleo.set_inverse_kinematics(x_dot, y_dot, theta_dot)

            # Handle additional slider controls
            elevator_value = data.sliders.elevator_position
            claw_value = data.sliders.claw_position

            # Map slider values to appropriate servo angles or PWM timings
            elevator_angle = nucleo.map_range(elevator_value, -1, 1, 0, 360)
            claw_angle = nucleo.map_range(claw_value, -1, 1, 0, 360)

            # Set the servo angles on the Nucleo board
            nucleo.set_servo_angle(ELEVATOR_CHANNEL, elevator_angle)
            nucleo.set_servo_angle(CLAW_CHANNEL, claw_angle)

            # Log received data (for debugging purposes)
            print(f"Joystick: {data.joystick}, Sliders: {data.sliders}")

    except websockets.exceptions.ConnectionClosed:
        print(f"Client disconnected: {path}")
    finally:
        # Stop all motors when the client disconnects
        nucleo.stop_all_steppers()
        connected_client = None


async def main():
    async with websockets.serve(handle_connection, HOST, PORT):
        print(f"WebSocket server started on ws://{HOST}:{PORT}")
        await asyncio.Future()  # Run forever


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("WebSocket server stopped.")
        nucleo.close()
