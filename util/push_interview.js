const { Router } = require("express");
const pool = require("../util/function");
const push_noti = require("../routes/push");

async function push_worker(interview_id, _title, _data){
    const con = await pool.getConnection(async (conn) => conn);
    
    /* worker_id 찾고 */
    console.log("select worker_id");
    const sql_interview = `select FK_interviews_workers, FK_interviews_stores from interviews where interview_id = ${interview_id};`;
    const [interview] = await con.query(sql_interview);
    
    console.log("select store's name");
    const sql_store = `select name from stores where store_id = ${interview[0]["FK_interviews_stores"]};`;
    const [store] = await con.query(sql_store);
    
    /* token 찾아서 push */
    
    console.log("select token");
    const sql_token = `select token from permissions 
        where FK_permissions_workers = ${interview[0]["FK_interviews_workers"]};`;
    const [token] = await con.query(sql_token);
    
    let push_token = token[0]["token"];
    console.log("token: ", interview[0]["FK_interviews_workers"], interview[0]["FK_interviews_stores"], push_token);
    
    let title = _title;
    let info = {
        store_name: store[0]["name"],
        result: _data
    };
    
    console.log("push_noti");
    push_noti(push_token, title, info);

}

async function push_owner(interview_id, _title, _data){
    console.log('들어옴? push_owner??');
    const con = await pool.getConnection(async (conn) => conn);
    
    /* worker_id 찾고 */
    console.log("select interview");
    const sql_interview = `select FK_interviews_workers, FK_interviews_stores from interviews where interview_id = ${interview_id};`;
    const [interview] = await con.query(sql_interview);
    
    console.log("select owner_id");
    const sql_store = `select FK_stores_owners from stores where store_id = ${interview[0]["FK_interviews_stores"]};`;
    const [store] = await con.query(sql_store);

    console.log("select worker's name");
    const sql_worker = `select name from workers where worker_id = ${interview[0]["FK_interviews_workers"]};`;
    const [worker] = await con.query(sql_worker);
    
    /* token 찾아서 push */
    
    console.log("select token");
    const sql_token = `select token from permissions 
        where FK_permissions_owners = ${store[0]["FK_stores_owners"]};`;
    const [token] = await con.query(sql_token);
    
    let push_token = token[0]["token"];
    console.log("owner, store, token: ", store[0]["FK_stores_owners"], interview[0]["FK_interviews_stores"], push_token);
    
    let title = _title;
    let info = {
        worker_name: worker[0]["name"],
        result: _data // 아직 내용 없음
    };
    
    console.log("push_noti");
    await push_noti(push_token, title, info);

}

module.exports.push_worker = push_worker;
module.exports.push_owner = push_owner;
