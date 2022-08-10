const { Router } = require("express");
const mysql = require("mysql2/promise");

const chattingRouter = Router();

const roomRouter = require('./chatting/room');
const messageRouter = require('./chatting/message');

const pool = require("../util/function");

chattingRouter.use('/room', roomRouter);
chattingRouter.use('/message', messageRouter);

module.exports = chattingRouter;
