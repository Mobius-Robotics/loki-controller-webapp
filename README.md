loki-controller-webapp
======================

Simple web-app that allows control of Loki via any smartphone.

Usage
-----

The client can be found at [a webpage hosted on GitHub pages](https://mobius-robotics.github.io/loki-controller-webapp/).

The server must be ran on the same network as the robot, on a computer connected via USB to the
Nucleo board. The server can be ran with the following command, after having ran `poetry install`:
```bash
poetry run python server.py
```
The server will be started at port 5743.
