const { Router } = require('express');
const roomRouter = Router();
const mysql = require("mysql2/promise");
const { getConnection } = require('../../util/function');

const pool = require('../../util/function');
const masageDate = require('../../util/masageDate');

/**************************
 *         create         *
 **************************/
/* input: { 'owner_id': 1, 'interview_id': 2 } */

/* 1. interview_id로 worker_id 가져오기 */
roomRouter.post('/create', async (req, res, next) => {
    console.log('/create 진입')
    const con = await pool.getConnection(async conn => conn);
    const sql = `SELECT FK_interviews_workers AS worker_id FROM interviews WHERE interview_id=${req.body['interview_id']}`

    const [result] = await con.query(sql);
    con.release();
    req.body['worker_id'] = result[0]['worker_id']
    next();
})

/* 2. room 테이블에 데이터 삽입 */
roomRouter.use('/create', async (req, res, next) => {
    console.log(req.body)
    const con = await pool.getConnection(async conn => conn);
    const sql = `INSERT INTO rooms SET identifier=?, last_chat=?, createdAt=?, updatedAt=?`;
    let identifier = req.body['owner_id'].toString() + '-' + req.body['worker_id'].toString()
    req.body['identifier'] = identifier;
    let date = masageDate.masageDateToYearMonthDayHourMinSec(new Date())
    req.body['date'] = date;
    await con.query(sql, [identifier, '', date, date])
    con.release();
    next();
})

/* 3. room_id 가져오기 */
roomRouter.use('/create', async (req, res, next) => {
    const con = await pool.getConnection(async conn => conn);
    const sql = `SELECT room_id
                 FROM rooms 
                 WHERE identifier=?`;
    
    const [result] = await con.query(sql, [req.body['identifier']])
    req.body['room_id'] = result[0]['room_id']
    console.log('3. room_id 가져오기 통과 ', req.body)
    con.release()
    next();
})

/* 4. room_participant_lists 테이블에 insert */
roomRouter.use('/create', async (req, res) => {
    const con = await pool.getConnection(async conn => conn);
    const sql = `INSERT INTO room_participant_lists
                 SET FK_room_participant_lists_rooms=?, user_id=?, user_type=?, createdAt=?, updatedAt=?`;
    await con.query(sql, [req.body['room_id'], req.body['owner_id'], 'owner', req.body['date'], req.body['date']]);
    con.release();
    console.log('4단계까지 완료')
    res.send('success');
})

/**************************
 *          list          *
 **************************/

/* input: { 'type': 'worker', 'id': 1 } */
/* room 정보 가져오기 */
// not_read_chat 추가 완료
roomRouter.post('/list', async (req, res, next) => {
    const con = await pool.getConnection(async conn => conn);
    const sql = `SELECT A.room_id, A.identifier, A.last_chat, A.updatedAt, B.name AS worker_name, C.name AS owner_name, D.not_read_chat
    FROM rooms A 
    INNER JOIN workers B ON SUBSTRING_INDEX(A.identifier,'-',-1)=B.worker_id
    INNER JOIN owners C ON SUBSTRING_INDEX(A.identifier,'-',1)=C.owner_id
    INNER JOIN room_participant_lists D ON A.room_id=D.FK_room_participant_lists_rooms AND D.user_type='${req.body['type']}'
    WHERE SUBSTRING_INDEX(A.identifier,'-',?)=${req.body['id']}`
    
    let flag;
    if (req.body['type'] === 'owner') flag = 1
    else flag = -1

    const [result] = await con.query(sql, [flag]);
    con.release();

    for (let i = 0; i < result.length; i++) {
        let identifier = result[i]['identifier'].split('-');
        let owner_id = identifier[0]
        let worker_id = identifier[1]
        if (req.body['type'] === 'worker') { // 현재 사용자가 worker라면
            result[i]['receiver_name'] = result[i]['owner_name']
            result[i]['receiver_id'] = owner_id
            result[i]['caller_name'] = result[i]['worker_name']
        }
        else {
            result[i]['receiver_name'] = result[i]['worker_name']
            result[i]['receiver_id'] = worker_id
            result[i]['caller_name'] = result[i]['owner_name']
        }
        
        let timeStamp = masageDate.masageDateToYearMonthDayHourMinSec(result[i]["updatedAt"]);
        result[i]["time"] = timeStamp.slice(0, -3);
        console.log(result[i]["time"]);
        delete result[i]["identifier"];
        delete result[i]["updatedAt"];
        delete result[i]["owner_name"];
        delete result[i]["worker_name"];

        
    }
    console.log(result)
    res.send(result)
})


/* input: { owner_id: 1 } */
roomRouter.post('/list/owner/:owner_id', async (req, res) => {
    const con = await pool.getConnection(async conn => conn);
    const sql = `SELECT * FROM rooms WHERE SUBSTRING_INDEX(identifier,'-',1)=${req.params.owner_id}`
    const [result] = await con.query(sql);
    con.release();
    console.log(result)
    res.json(result)
})

// GET 방식
// roomRouter.post('/list/owner/:owner_id', async (req, res) => {
//     const con = await pool.getConnection(async conn => conn);
//     const sql = `SELECT * FROM room WHERE SUBSTRING_INDEX(identifier,'-',1)=${req.params.owner_id}`
//     const [result] = await con.query(sql);
//     con.release();
//     console.log(result)
//     res.json(result)
// })



module.exports = roomRouter;