const { Router } = require('express');
const messageRouter = Router();
const mysql = require("mysql2/promise");
const { getConnection } = require('../../util/function');

const pool = require('../../util/function');
const masageDate = require('../../util/masageDate');

const express = require('express')
const app = express();
let http = require('http');
let server = http.createServer(app);
let socketio = require('socket.io');
let io = socketio.listen(server);

module.exports = messageRouter;

/****************************
 *          insert          *
 ****************************/

// io.on('connection', (socket) => {
//     socket.on('message', async (messageObj) => {
//         const { room_id, send_user_id, message, not_read } = messageObj;
//         const con = await pool.getConnection(async conn => conn);
//         const sql = `INSERT INTO chattings  `
//     })
// })

/*
{
    "room_id": 6,
    "send_user_id": 4,
    "send_user_type": 'owner',
    "message": "알바생님 안녕하세요",
    "createdAt": "2022-07-25 10:23"
}
*/
/* 1. 우선 chatting 테이블에 INSERT */
messageRouter.post('/save', async (req, res, next) => {
    const con = await pool.getConnection(async conn => conn);
    const sql = `INSERT INTO chattings SET ?`;
    let date = new Date();
    let sec = date.getSeconds().toString();
    if (sec.length === 1)
        sec = '0'+sec
    req.body['createdAt'] += (':'+sec);
    req.body['updatedAt'] = req.body['createdAt']
    req.body['not_read'] = 1

    req.body['FK_chattings_rooms'] = req.body['room_id']
    delete req.body['room_id']

    await con.query(sql, req.body)
    con.release();
    next();
})

/* 2. room 테이블의 last_chat, updatedAt 업데이트 */
messageRouter.use('/save', async (req, res, next) => {
    const con = await pool.getConnection(async conn => conn);
    const sql = `UPDATE rooms SET last_chat=?, updatedAt=? WHERE room_id=?`;
    console.log([req.body['message'], req.body['createdAt'], req.body['FK_chattings_rooms']])
    await con.query(sql, [req.body['message'], req.body['createdAt'], req.body['FK_chattings_rooms']]);
    con.release();

    next();
})

/* 3. room_participant_lists 테이블의 not_read_chat, last_chatting_id, updatedAt 업데이트 */
messageRouter.use('/save', async (req, res) => {
    const con = await pool.getConnection(async conn => conn);
    // 해당 room의 last_chatting_id 가져오기
    const sql = `SELECT chatting_id 
                 FROM chattings
                 WHERE FK_chattings_rooms=? 
                 order by chatting_id desc
                 LIMIT 1`
    const [last_chatting_id] = await con.query(sql, req.body['FK_chattings_rooms']);
    console.log(last_chatting_id)
    // console.log()
    // const tmp = `SELECT * FROM room_participant_lists WHERE FK_room_participant_lists_rooms=?`
    // const [result] = await con.query(tmp, [req.body['FK_chattings_rooms']])

    // 3-1. not_read_chat update
    const sql2 = `UPDATE room_participant_lists 
                 SET not_read_chat=not_read_chat+1
                 WHERE FK_room_participant_lists_rooms=? AND user_type!='${req.body['send_user_type']}'`;
    await con.query(sql2, [req.body['FK_chattings_rooms']]);

    const sql3 = `UPDATE room_participant_lists 
                  SET last_chatting_id=?, updatedAt=?
                  WHERE FK_room_participant_lists_rooms=?`;
    await con.query(sql3, [last_chatting_id[0]['chatting_id'], req.body['createdAt'], req.body['FK_chattings_rooms']]);

    con.release();
    res.send('success');
})

/****************************
 *            get           *
 ****************************/

/* 
    { "room_id": 6, "cursor": "null" } cursor는 chatting_id. 여기서부터 일정 개수 읽어오는 방식으로 구현해야 한다. null이면 처음부터
*/
/* { 'room_id': 6, 'cursor': null, 'user_id': 20, 'user_type': 'owner' } */

/* 1. 안 읽은 메시지가 몇 갠지 가져오기 */
messageRouter.get('/loading', async (req, res, next) => {

    const con = await pool.getConnection(async conn => conn);
    console.log(req.query)

    const sql = `SELECT not_read_chat 
                 FROM room_participant_lists 
                 WHERE FK_room_participant_lists_rooms='${req.query.room_id}' AND user_id='${req.query.user_id}' AND user_type='${req.query.user_type}' LIMIT 1`
    const [result] = await con.query(sql);
    req.query['not_read_chat'] = result[0]['not_read_chat']
    console.log('/loading 1. 통과');
    con.release();
    next();
})

/* 2. chattings 테이블에서 not_read=0으로 update */
messageRouter.use('/loading', async (req, res, next) => {
    const con = await pool.getConnection(async conn => conn);
    
    const sql = `UPDATE chattings
                 SET not_read=0
                 WHERE FK_chattings_rooms='${req.query.room_id}' AND send_user_type!='${req.query.user_type}' AND not_read=1`
    await con.query(sql);
    console.log('/loading 2. 통과');
    con.release();
    next();
})

/* 3. room_participant_lists 테이블에서 not_read_chat=0으로 update */
messageRouter.use('/loading', async (req, res, next) => {
    const con = await pool.getConnection(async conn => conn);

    const sql = `UPDATE room_participant_lists
                 SET not_read_chat=0
                 WHERE FK_room_participant_lists_rooms='${req.query.room_id}' AND user_id='${req.query.user_id}' AND user_type='${req.query.user_type}' LIMIT 1`
    await con.query(sql);
    console.log('/loading 3. 통과');
    con.release();
    next();
})

/* message client에 send */
messageRouter.use('/loading', async (req, res) => {
    console.log(req.query.room_id);
    console.log(req.query.cursor);

    const con = await pool.getConnection(async conn => conn);
    const sql = `
    SELECT A.chatting_id, A.FK_chattings_rooms AS room_id, A.send_user_id, A.send_user_type, A.message, A.createdAt, A.not_read, B.name AS owner_name, C.name AS worker_name
    FROM chattings A
    INNER JOIN owners B ON A.send_user_id = B.owner_id
    INNER JOIN workers C ON A.send_user_id = C.worker_id
    WHERE chatting_id<? AND FK_chattings_rooms=? ORDER BY chatting_id DESC LIMIT 40`
    
    let cursor = Number(req.query.cursor) || 9999999999;
    const [result] = await con.query(sql, [cursor, req.query.room_id]);

    for (let i = 0; i < result.length; i++) {
        result[i]['createdAt'] = masageDate.masageDateToYearMonthDayHourMinSec(result[i]['createdAt']).slice(0,-3)
        if (result[i]['send_user_type'] === 'owner') {
            result[i]['caller_name'] = result[i]['owner_name']
        } else {
            result[i]['caller_name'] = result[i]['worker_name']
        }
        delete result[i]['owner_name']
        delete result[i]['worker_name']
    }
    con.release();
    console.log(result)
    res.send(result);
})

messageRouter.get('/loading/:room_id/:cursor', async (req, res) => {
    const con = await pool.getConnection(async conn => conn);
    const sql = `
    SELECT A.chatting_id, A.FK_chattings_rooms AS room_id, A.send_user_id, A.send_user_type, A.message, A.updatedAt, A.not_read, B.name AS owner_name, C.name AS worker_name
    FROM chattings A
    INNER JOIN owners B ON A.send_user_id = B.owner_id
    INNER JOIN workers C ON A.send_user_id = C.worker_id
    WHERE chatting_id<? AND FK_chattings_rooms=? ORDER BY chatting_id DESC LIMIT 10`
    
    let cursor = Number(req.params.cursor) || 9999999999;
    const [result] = await con.query(sql, [cursor, req.params.room_id]);

    for (let i = 0; i < result.length; i++) {
        result[i]['updatedAt'] = masageDate.masageDateToYearMonthDayHourMinSec(result[i]['updatedAt'])
        if (result[i]['send_user_type'] === 'owner') {
            result[i]['caller_name'] = result[i]['owner_name']
        } else {
            result[i]['caller_name'] = result[i]['worker_name']
        }
        delete result[i]['owner_name']
        delete result[i]['worker_name']
    }
    con.release();
    res.send(result);
})

/* { 'room_id': 28, 'user_id': 20, 'user_type': 'owner' } */
/* 1. 안 읽은 메시지가 몇 갠지 가져오기 */
messageRouter.get('/read', async (req, res, next) => {
    const con = await pool.getConnection(async conn => conn);
    console.log(req.query)


    const sql = `SELECT not_read_chat 
                 FROM room_participant_lists 
                 WHERE FK_room_participant_lists_rooms='${req.query.room_id}' AND user_id='${req.query.user_id}' AND user_type='${req.query.user_type}' LIMIT 1`
    const [result] = await con.query(sql);
    req.query['not_read_chat'] = result[0]['not_read_chat']
    
    con.release();
    next();
})

/* 2. chattings 테이블에서 not_read=0으로 update */
messageRouter.use('/read', async (req, res, next) => {
    const con = await pool.getConnection(async conn => conn);
    
    const sql = `UPDATE chattings
                 SET not_read=0
                 WHERE FK_chattings_rooms='${req.query.room_id}' AND send_user_type!='${req.query.user_type}' AND not_read=1`
    await con.query(sql);
    con.release();
    next();
})

/* room_participant_lists 테이블에서 not_read_chat=0으로 update */
messageRouter.use('/read', async (req, res) => {
    const con = await pool.getConnection(async conn => conn);

    const sql = `UPDATE room_participant_lists
                 SET not_read_chat=0
                 WHERE FK_room_participant_lists_rooms='${req.query.room_id}' AND user_id='${req.query.user_id}' AND user_type='${req.query.user_type}' LIMIT 1`
    await con.query(sql);
    con.release();
    res.send('success');
})