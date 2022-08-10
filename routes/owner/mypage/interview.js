const { Router } = require("express");
const interviewRouter = Router();
const mysql = require("mysql2/promise");

const pool = require("../../../util/function");
const masageDate = require("../../../util/masageDate");
const push_interview = require("../../../util/push_interview");
// const push_noti = require("../../push");

/* state = 1(입장대기)일 때  */
/* {inerview_id:1 } */
interviewRouter.post("/exit", async (req, res) => {
  // 해당 인터뷰 state 변경
  const con = await pool.getConnection(async (conn) => conn);
  const interview_id = req.body["interview_id"];
  console.log("/owner/interview/exit", interview_id);
  try {
    const sql = `update interviews set state = 4 where interview_id = ${interview_id}`;
    const [result] = await con.query(sql);

    con.release();
    res.send({ state: "success" });
  } catch {
    con.release();
    res.send({ state: "fail" });
  }
});

/* state = 2(승인대기)일 때 수락or거절 선택 */
/* {inerview_id:1, value:true/false} */
interviewRouter.post("/accept", async (req, res) => {
    const con = await pool.getConnection(async (conn) => conn);
    let msg = "";
    console.log("accept");
    const interview_id = req.body["interview_id"];
    const value = req.body["value"];
    // console.log(interview_id, value, typeof value);
    try {
        msg = "update state";
        // 시연을 위한 흐름
        // 원래는 2 -> 3 -> 1
        // 지금은 2 -> 1 거절시에만 3
        if (value !== "true" && value !== true) {
            // 거절
            // console.log('거절', value);
            const sql = `update interviews set state = 3, reject_flag = 1 where interview_id = ${interview_id};`;
            // const sql = `update interviews set state = 3, reject_flag = 1 where interview_id = ${interview_id};`;
            const [result] = await con.query(sql);
        } else {
            // 수락
            // console.log('수락', value);
            const sql = `update interviews set state = 1, reject_flag = 0 where interview_id = ${interview_id};`;
            // const sql = `update interviews set state = 3, reject_flag = 0 where interview_id = ${interview_id};`;
            const [result] = await con.query(sql);
        }
        // console.log('result: ',result);

        
        // /* worker_id 찾고 */
        // msg = "select worker_id";
        // const sql_worker = `select FK_interviews_workers, FK_interviews_stores from interviews where interview_id = ${interview_id};`;
        // const [worker] = await con.query(sql_worker);
        
        // msg = "select name";
        // const sql_store = `select name from stores where store_id = ${worker[0]["FK_interviews_stores"]};`;
        // const [store] = await con.query(sql_store);
        
        // /* token 찾아서 push */
        
        // msg = "select token";
        // const sql_token = `select token from permissions 
        //     where FK_permissions_workers = ${worker[0]["FK_interviews_workers"]};`;
        // const [token] = await con.query(sql_token);
        
        // let push_token = token[0]["token"];
        // console.log("token: ", worker[0]["FK_interviews_workers"], worker[0]["FK_interviews_stores"], push_token);
        
        let title = "면접 신청결과";
        let data = (value !== "true" && value !== true) ? 'reject' : 'accept';
        // let info = {
        //         store_name: store[0]["name"],
        //         result: (value !== "true" && value !== true) ? 'reject' : 'accept'
        //     };
            
        push_interview.push_worker(interview_id, title, data);

        // msg = "push_noti";
        // await push_noti(push_token, title, info);

        con.release();
        res.send("success");
    } 
    catch {
        con.release();
        console.error(`error-${msg}`);
        res.send(`error`);
    }
});

/* state = 3일 때  */
/* {inerview_id:1, value:true/false} */
interviewRouter.post("/result", async (req, res) => {
  const con = await pool.getConnection(async (conn) => conn);
  let msg = "";
  const interview_id = req.body["interview_id"];
  const value = req.body["value"];
  console.log(interview_id, value, typeof value);
  try {
        /* worker_id 찾고 */
        msg = "select worker_id";
        const sql_worker = `select FK_interviews_workers, FK_interviews_stores from interviews where interview_id = ${interview_id};`;
        const [worker] = await con.query(sql_worker);

        msg = "update state";
        if (value !== "true" && value !== true) {
            // console.log('불합격ㅠ', value);
            const sql = `update interviews set state = 5, result_flag = 0 where interview_id = ${interview_id};`;
            const [result] = await con.query(sql);
        } else {
            console.log('합격!!!', value);
            const sql = `update interviews set state = 5, result_flag = 1 where interview_id = ${interview_id};`;
            const [result] = await con.query(sql);
            
            console.log('합격!!!', worker[0]["FK_interviews_workers"], worker[0]["FK_interviews_stores"]);
            const sql_qual = `insert into qualifications (fk_qualifications_workers, FK_qualifications_stores) values(${worker[0]["FK_interviews_workers"]}, ${worker[0]["FK_interviews_stores"]});`;
            const [qual] = await con.query(sql_qual);

            /* create chatting room */
            /* 1. interview_id로 worker_id 가져오기 */
            msg = "interview_id로 worker_id 가져오기";
            console.log("/create 진입");
            console.log(req.body);
            const sql2 = `SELECT FK_interviews_workers AS worker_id FROM interviews WHERE interview_id=${req.body["interview_id"]}`;

            const [result_room] = await con.query(sql2);
            req.body["worker_id"] = result_room[0]["worker_id"];
            console.log(result_room);

            /* 2. room 테이블에 데이터 삽입 */
            try {
                msg = "room 테이블에 데이터 삽입";
                const sql3 = `INSERT INTO rooms SET identifier=?, last_chat=?, createdAt=?, updatedAt=?`;
                let identifier =
                req.body["owner_id"].toString() + "-" + req.body["worker_id"].toString();
                req.body["identifier"] = identifier;
                let date = masageDate.masageDateToYearMonthDayHourMinSec(new Date());
                console.log(req.body);
                await con.query(sql3, [identifier, "", date, date]);
                
                /* 3. room_id 가져오기 */
                msg = "room_id 가져오기";
                const sql4 = `SELECT room_id
                FROM rooms 
                WHERE identifier=?`;
                
                const [result4] = await con.query(sql4, [req.body['identifier']])
                req.body['room_id'] = result4[0]['room_id']
                console.log('3. room_id 가져오기 통과 ', req.body)
                
                /* 4. room_participant_lists 테이블에 insert */
                const sql5 = `INSERT INTO room_participant_lists
                        SET FK_room_participant_lists_rooms=?, user_id=?, user_type=?, createdAt=?, updatedAt=?`;
            await con.query(sql5, [req.body['room_id'], req.body['owner_id'], 'owner', date, date]);
            await con.query(sql5, [req.body['room_id'], req.body['worker_id'], 'worker', date, date])
            console.log('4단계까지 완료')
            } catch {
                console.log('room이 이미 존재합니다.');
            }
            
            // console.log('합격!!!');
        }
        // const [result] = await con.query(sql);
        // console.log('result: ',result);

        

        // msg = "select name";
        // const sql_store = `select name from stores where store_id = ${worker[0]["FK_interviews_stores"]};`;
        // const [store] = await con.query(sql_store);

        // /* token 찾아서 push */

        // msg = "select token";
        // const sql_token = `select token from permissions 
        //     where FK_permissions_workers = ${worker[0]["FK_interviews_workers"]};`;
        // const [token] = await con.query(sql_token);

        // let push_token = token[0]["token"];
        // console.log("token: ", push_token);

        // let title = "면접 결과";
        // let info = {
        // store_name: store[0]["name"],
        // };
        
        let title = "면접 결과";
        let data = (value !== "true" && value !== true) ? 'fail' : 'success';
           
        push_interview.push_worker(interview_id, title, data);

        // msg = "push_noti";
        // await push_noti(push_token, title, info);

        con.release();
        res.send("success");
    } catch {
        con.release();
        console.log(`error - ${msg}`);
        res.send(`error`);
    }
});

module.exports = interviewRouter;
