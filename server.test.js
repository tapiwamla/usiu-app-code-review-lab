
const express = require("express");
const app = express();
const http = require('http');
const {Server}= require('socket.io');
const ioc = require("socket.io-client");
import { v4 as uuidV4 } from 'uuid';

const ACTIONS = require('./actions/Actions');
const PORT = process.env.PORT || 5000;
const socketUrl = 'http://localhost:5000';

describe('Server.js Tests', () =>{
    jest.setTimeout(8000);

    let io, serverSocket, clientSocket, client2;
    const userSocketMap = {};
    const rid = uuidV4();
    
    beforeAll((done) => {
        const httpServer = http.createServer(app);
         io = new Server(httpServer);

        httpServer.listen(PORT,  () =>{
            const port = httpServer.address().port;
            client2 = ioc.connect(socketUrl, {
                'force new connection': true,
                  reconnectionAttempt: 'Infinity',
                timeout: 10000,
                transports: [ 'websocket' ]
              });
             io.on('connection', (socket) => {
                serverSocket = socket;
              });
              
                client2.on('connect',done);
              
        });
        

    });
    afterAll(() => {
        io.close();
    });
    //function from server.js
    function getAllConnectedClients(roomId) {
        return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map((socketId) => {
            return {
                socketId,
                username: userSocketMap[ socketId ]
            };
        });
    }

    //function to create clients
    const makeSocket = () => {
        const socket = ioc.connect(socketUrl, {
            'force new connection': true,
            reconnectionAttempt: 'Infinity',
            timeout: 10000,
            transports: [ 'websocket' ]
        });
        socket.on("connect", () => {
          console.log(`[client ${id}] connected`);
        });
        socket.on("disconnect", () => {
          console.log(`[client ${id}] disconnected`);
        });
        //sockets.push(socket);
        return socket;
      };
      

    test('Server adding client', (done) => {                      
        
        //Server actions when user joins
        serverSocket.on(ACTIONS.JOIN, ( {roomId, username} ) => {
            userSocketMap[ serverSocket.id ] = username;
            serverSocket.join(roomId);
    
            const clients = getAllConnectedClients(roomId);
    
            if (Array.isArray(clients)) {
                clients.forEach(({ socketId }) => {
                    io.to(socketId).emit(ACTIONS.JOINED, {
                        clients,
                        username,
                        socketId: serverSocket.id,
                    });
                });
            } else {
                console.log('Clients data is not an array:', clients);
            }
        });
        

         client2.emit(ACTIONS.JOIN, {
            rid,
            username: "user1",
        });
          client2.on(ACTIONS.JOINED, ( {clients, username, socketId} )=>{
            const userJoin = userSocketMap[socketId];
            expect(userJoin).toBe("user1");
           done();
        });
        

    });

    test('Can delete user', (done)=>{
        //when user disconnects
        serverSocket.on(ACTIONS.LEAVE_ROOM, ({ roomId, username }) => {
            const leavingSocketId = Object.keys(userSocketMap).find(key => userSocketMap[ key ] === username);
    
            if (leavingSocketId) {
                // Emit a custom event to notify other clients that the user left
                io.to(roomId).emit(ACTIONS.DISCONNECTED, {
                    socketId: leavingSocketId,
                    username: userSocketMap[ leavingSocketId ],
                });
    
                // Remove the user from the userSocketMap
                delete userSocketMap[ leavingSocketId ];
            }
        });
        client2.emit(ACTIONS.LEAVE_ROOM,{
            rid,
            username: "user1"
        });
        client2.on(ACTIONS.DISCONNECTED, ({socketId, username})=>{
            const userLeft = userSocketMap[socketId];
            expect(userLeft).toBeInvalid;
            done();
        });
    });
});
