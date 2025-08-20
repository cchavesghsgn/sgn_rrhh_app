
#!/bin/bash
cd /home/ubuntu/sgn_rrhh_app/app
echo "Starting development server..."
yarn dev > /tmp/dev-server.log 2>&1 &
SERVER_PID=$!
echo "Server started with PID: $SERVER_PID"
echo $SERVER_PID > /tmp/dev-server.pid
sleep 3
echo "Server logs:"
tail -20 /tmp/dev-server.log
