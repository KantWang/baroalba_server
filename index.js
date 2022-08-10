const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const mysql = require("mysql2/promise");
const path = require("path");
const nodeGeocoder = require("node-geocoder");
const app = express();
const PORT = process.env.PORT || 4000;

/****************************************/
const checkRouter = require("./routes/check");
const workerRouter = require("./routes/worker");
const storeerRouter = require("./routes/store");
const ownerRouter = require("./routes/owner");
const reserveRouter = require("./routes/reserve");
const applyRouter = require("./routes/apply");
const permissionRouter = require("./routes/permission");
const chattingRouter = require("./routes/chatting");

/****************************************/
/* production mode */
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../build")));

  app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../build", "index.html"));
  });
}
/* console.log depth에 필요 */
let util = require("util");
// const { off } = require("process");

/* 구글 map api */
const options = {
  provider: "google",
  apiKey: "AIzaSyAHZxHAkDSHoI-lJDCg5YfO7bLCFiRBpaU", // 요놈 넣어만 주면 될듯?
};
const geocoder = nodeGeocoder(options);

const pool = require("./util/function");
const push_interview = require("./util/push_interview");

app.use(bodyParser.urlencoded({ extended: false }));
app.use(cors());
app.use(bodyParser.json());
/****** webrtc - interview ******/
let http = require("http");
let server = http.createServer(app);
let socketio = require("socket.io");
const { default: job } = require("./timer");
let io = socketio.listen(server);
let socketToRoom = {};
let users = {};

const maximum = 2;

io.on("connection", (socket) => {
  socket.on("join_room", (data) => {
    if (users[data.room]) {
      const length = users[data.room].length;
      if (length === maximum) {
        socket.to(socket.id).emit("room_full");
        return;
      }
      users[data.room].push({ id: socket.id });
    } else {
      users[data.room] = [{ id: socket.id }];
    }
    socketToRoom[socket.id] = data.room;

    socket.join(data.room);
    console.log(`[${socketToRoom[socket.id]}]: ${socket.id} enter`);

    const usersInThisRoom = users[data.room].filter(
      (user) => user.id !== socket.id
    );

    console.log(usersInThisRoom);

    io.sockets.to(socket.id).emit("all_users", usersInThisRoom);
  });

  socket.on("offer", (sdp) => {
    // console.log('offer: ' + socket.id);
    socket.broadcast.emit("getOffer", sdp);
  });

  socket.on("answer", (sdp) => {
    // console.log('answer: ' + socket.id);
    socket.broadcast.emit("getAnswer", sdp);
  });

  socket.on("candidate", (candidate) => {
    // console.log('candidate: ' + socket.id);
    socket.broadcast.emit("getCandidate", candidate);
  });

  socket.on("disconnect", () => {
    // console.log(`[${socketToRoom[socket.id]}]: ${socket.id} exit`);
    const roomID = socketToRoom[socket.id];
    let room = users[roomID];
    if (room) {
      room = room.filter((user) => user.id !== socket.id);
      users[roomID] = room;
      if (room.length === 0) {
        delete users[roomID];
        return;
      }
    }
    socket.broadcast.to(room).emit("user_exit");
    console.log(users);
  });

  socket.on("leave_room", () => {
    const roomID = socketToRoom[socket.id];
    console.log("server roomID:", roomID);
    socket.leave("roomID");

    socket.broadcast.emit(`${roomID}`, "상대방이 나갔습니다.");
  });

  socket.on("join_chat_room", (data) => {
    console.log(data);
    socket.join(data);
    console.log("join_ok");
  });

  socket.on("send_message", async (data) => {
    console.log("11111", data);

    delete data["caller_name"];
    const con = await pool.getConnection(async (conn) => conn);
    const sql = `INSERT INTO chattings 
                 SET ?`;
    let date = new Date();
    let sec = date.getSeconds().toString();
    if (sec.length === 1) sec = "0" + sec;

    data["createdAt"] = data["createdAt"] + ":" + sec;
    data["updatedAt"] = data["createdAt"];

    data["FK_chattings_rooms"] = data["room_id"];
    data["not_read"] = 1;
    delete data["room_id"];
    delete data["time"];

    await con.query(sql, data);

    /* 2. room 테이블의 last_chat, updatedAt 업데이트 */
    const sql2 = `UPDATE rooms 
                  SET last_chat=?, updatedAt=? 
                  WHERE room_id=?`;
    await con.query(sql2, [
      data["message"],
      data["createdAt"],
      data["FK_chattings_rooms"],
    ]);

    /* 3. room_participant_lists 테이블의 not_read_chat, last_chatting_id, updatedAt 업데이트 */
    // last_chatting_id 가져오기
    const sql3 = `SELECT chatting_id 
                  FROM chattings
                  WHERE FK_chattings_rooms=? 
                  order by chatting_id desc
                  LIMIT 1`;
    const [last_chatting_id] = await con.query(
      sql3,
      data["FK_chattings_rooms"]
    );

    // 3-1. not_read_chat update
    const sql4 = `UPDATE room_participant_lists 
                  SET not_read_chat=not_read_chat+1
                  WHERE FK_room_participant_lists_rooms=? AND user_type!='${data["send_user_type"]}'`;
    await con.query(sql4, [data["FK_chattings_rooms"]]);

    // 3-2. last_chatting_id, updatedAt update
    const sql5 = `UPDATE room_participant_lists 
                  SET last_chatting_id=?, updatedAt=?
                  WHERE FK_room_participant_lists_rooms=?`;
    await con.query(sql5, [
      last_chatting_id[0]["chatting_id"],
      data["createdAt"],
      data["FK_chattings_rooms"],
    ]);

    const sql6 = `SELECT not_read_chat
                  FROM room_participant_lists
                  WHERE FK_room_participant_lists_rooms='${data["FK_chattings_rooms"]}' AND user_type!='${data["send_user_type"]}'`;
    const [result] = await con.query(sql6);
    console.log("not read chat: ", result[0]["not_read_chat"]);
    data["not_read_chat"] = result[0]["not_read_chat"];
    data["room_id"] = data["FK_chattings_rooms"];
    socket.to(data.room_id).emit("receive_message", data);

    // 모든 수신자에게 발송
    data["not_read"] = 0;
    socket.to(data.room_id).emit("read_message", data);

    con.release();
    console.log("ok");
  });

  socket.on("read_ok", async (data) => {
    socket.to(data.room_id).emit("reload", data);
  });

  socket.on("read_that", async (data) => {
    socket.to(data["room_id"]).emit("reload2");
  });
});

app.post("/worker_interview", (req, res, next) => {
  console.log('>>>>>>>', req.body);
  const interviewId = req.body["interviewId"];
  for (const roomName of Object.values(socketToRoom)) {
    if (parseInt(roomName) === interviewId) {
      console.log(">>>>>",interviewId, "워커 출입 가능");
      return res.send({ enter: true, room: roomName });
    }
  }
  console.log(">>>>>",  interviewId, "워커 출입 불가능");
  return res.send({ enter: false });
});

app.post("/owner_interview", (req,res) => {
  // 푸쉬 작업  
  push_interview.push_worker(req.body.room, "화상면접 개설", "들어오쎄용");
  return res.send({status:"success"});
});
app.use("/check", checkRouter);
app.use("/worker", workerRouter);
app.use("/store", storeerRouter);
app.use("/owner", ownerRouter);
app.use("/reserve", reserveRouter);
app.use("/apply", applyRouter);
app.use("/permission", permissionRouter);
app.use("/chatting", chattingRouter);

/* 일정 주기로 실행되며 DB 업데이트 실행 */
let timers = require("./timer");
const angelRouter = require("./routes/worker/angel");
timers.job();
timers.interview();

server.listen(PORT, () => {
  console.log(`server running on ${PORT}`);
});
