const { Router } = require("express");
const angelRouter = Router();

const pool = require("../../util/function");
const getDist = require("../../util/getDist");
const push_noti = require("../push");
// const push_angel = require('../');
// const stop_call = require('../owner/angel');

/* 
  input = {
    'angel_id' : 1,
    'worker_id' : 17
  } 
*/
angelRouter.post("/info", async (req, res) => {
  console.log(req.body);
  const con = await pool.getConnection(async (conn) => conn);

  try {
    const angel_id = req.body["angel_id"];
    const worker_id = req.body["worker_id"];

    /* 1. angel 데이터 꺼내고 */
    const sql_angel = `select FK_angels_stores, FK_angels_workers, start_time, working_hours, price, FK_angels_jobs 
                          from angels where angel_id = ${angel_id};`;
    const [angel_info] = await con.query(sql_angel);

    console.log("angel: ", angel_info);

    let store_id = angel_info[0]["FK_angels_stores"];
    let start_time = angel_info[0]["start_time"].toISOString();
    let date = start_time.split("T")[0];
    let start = Number(start_time.split("T")[1].split(":")[0]);
    let hours = angel_info[0]["working_hours"];
    let end = start + hours;
    let price = angel_info[0]["price"];
    let job_id = angel_info[0]["FK_angels_jobs"];

    /* 2. 알바생 name, lat, lon 꺼내고, 유형 가져오고 */
    const sql_store = `select name, latitude, longitude from stores where store_id = ${store_id};`;
    const [store_info] = await con.query(sql_store);
    const sql_worker = `select name, location, latitude, longitude from workers where worker_id = ${worker_id};`;
    const [worker_info] = await con.query(sql_worker);
    console.log("store: ", store_info);
    console.log("worker: ", worker_info);

    const sql_job = `select type from jobs where job_id = ${job_id}`;
    const [job] = await con.query(sql_job);
    let type = job[0]["type"];

    console.log("type: ", type);

    /* 3. 거리계산 해서 res */
    let dist = getDist.getDistance(
      store_info[0]["latitude"],
      store_info[0]["longitude"],
      worker_info[0]["latitude"],
      worker_info[0]["longitude"]
    );

    let result = {
      store_name: store_info[0]["name"],
      date: date,
      start_time: start + ":00",
      end_time: end + ":00",
      hours: hours,
      price: price,
      type: type,
      dist: dist,
      location: worker_info[0]["location"],
    };
    console.log(result);
    con.release();
    res.send(result);
  } catch {
    con.release();
    res.send("error");
  }
});

/* 
  input form
  {
    'angel_id': 1,
    'worker_id': 17
  }
*/
angelRouter.post("/accept", async (req, res) => {
  console.log("accept: ", req.body);
  const con = await pool.getConnection(async (conn) => conn);
  let angel_id = req.body["angel_id"];
  let worker_id = req.body["worker_id"];

  try {
    /* 1. 유효한 요청인지 확인 */
    const sql_check = `select FK_angels_stores, status from angels where angel_id = ${angel_id};`;
    const [check] = await con.query(sql_check);
    console.log("check: ", check);
    let store_id = check[0]["FK_angels_stores"];
    let status = check[0]["status"];
    let result = "";

    const sql_owner = `select FK_stores_owners from stores where store_id = ${store_id};`;
    const [owner] = await con.query(sql_owner);
    console.log("owner: ", owner);
    let owner_id = owner[0]["FK_stores_owners"];
    // console.log("owner: ", owner_id);
    // console.log("sta: ", status);

    if (status === 0) {
      /* 2. angel 테이블에 worker 추가 및 status 갱신 */
      const sql = `update angels set FK_angels_workers = ${worker_id}, status = 1 where angel_id = ${angel_id};`;
      
      try{
        await con.query(sql);
        console.log('UPDATE');

        /* 3. 모집종료, 사장님한테 push() 요청 */
        const sql_token = `select FK_permissions_owners, token from permissions 
        where FK_permissions_owners = ${owner_id};`;
        const [token] = await con.query(sql_token);
  
        let push_token = token[0]["token"];
        console.log(push_token);
  
        const sql_worker = `select name from workers where worker_id = ${worker_id};`;
        const [worker] = await con.query(sql_worker);
        let worker_name = worker[0]["name"];
  
        let title = `알바천사 결과`;
        let info = {
          result: "success",
          angel_id: angel_id,
          worker_name: worker_name,
        };
  
        /* 3-3. tokens 로 push_angel() 호출 */
        push_noti(push_token, title, info);
        result = "success";
      }
      catch(error){
        // console.log("error", error);
        // console.log('>>>err: ', error.errno);
        errCode = error.errno;
        if(errCode===1062){
          /* 같은 시간에 알바천사예약이 있는거 */
          result = "already"
        }
        else{
          result = "error"
        }
      }

    } else {
      /* 이미 만료된 요청 */
      result = `fail`;
    }

    con.release();
    console.log(result);
    res.send(result);
  } catch {
    con.release();
    res.send("error");
  }
});

module.exports = angelRouter;

/************************ function *************************/

//   /* 두 개의 좌표 간 거리 구하기 */
// function getDistance(lat1, lon1, lat2, lon2) {
//     if ((lat1 == lat2) && (lon1 == lon2)) return 0;

//     let radLat1 = Math.PI * lat1 / 180;
//     let radLat2 = Math.PI * lat2 / 180;

//     let theta = lon1 - lon2;
//     let radTheta = Math.PI * theta / 180;
//     let dist = Math.sin(radLat1) * Math.sin(radLat2) + Math.cos(radLat1) * Math.cos(radLat2) * Math.cos(radTheta);

//     if (dist > 1) dist = 1;

//     dist = Math.acos(dist);
//     dist = dist * 180 / Math.PI;
//     dist = dist * 60 * 1.1515 * 1.609344 * 1000;

//     if (dist < 100) dist = Math.round(dist / 10) * 10;
//     else dist = Math.round(dist / 100) * 100;

//     return dist;
// }
