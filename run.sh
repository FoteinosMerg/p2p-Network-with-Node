killall node &
sleep 2.0 &
rm -r databases/* &
sleep 2.0 &
ADDRESS=localhost HTTP_PORT=5000 P2P_PORT=8080 npm run dev
