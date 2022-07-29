const { Router } = require("express");
const angelRouter = Router();
const pool = require("../../function");
const push_angel = require("../push_angel");
const push_noti = require("../push");

/* 
  input = {
    'owner_id' : 2
  } 
*/
angelRouter.get("/", async (req, res) => {
  const con = await pool.getConnection(async (conn) => conn);

  try {
    const owner_id = req.query["owner_id"];

    /* 1. store 찾아서 job type 꺼내고 */
    const sql = `SELECT store_id FROM stores WHERE FK_stores_owners=${owner_id}`;
    const [store_info] = await con.query(sql);
    let store_id = store_info[0]["store_id"];

    console.log(store_id);
    const sql_job = `select type from jobs 
                        where job_id in (select FK_store_job_lists_jobs from store_job_lists 
                        where FK_store_job_lists_stores = ${store_id});`;
    const [job_info] = await con.query(sql_job);
    type = [];
    for (job of job_info) {
      type.push(job["type"]);
    }
    console.log("type: ", type);

    /* 2. 예쁘게 담아서 넘겨주기 */
    let result = {
      type: type,
    };
    console.log("result:", result);
    res.send(result);
    con.release();
  } catch {
    con.release();
    res.send("error");
  }
});

/* 
  input form
  {
    'owner_id': 1,
    'type': '설거지',
    'start_time': '10:00',
    'end_time': '14:00',
    'price': 10000 
  }
*/
angelRouter.post("/call", async (req, res) => {
  console.log("req: ", req.body);
  const con = await pool.getConnection(async (conn) => conn);
  let send_flag = false;
  let send_msg = "";
  try {
    /* 1. store_id, job_id 가져오고 */
    const store_id = await getStoreIdByOwnerId(req, res);
    const job_id = await getJobIdByType(req, res);

    // const store_id = req.body['store_id'];
    // const job_id = req.body['job_id'];
    console.log(store_id, job_id);
    /* 2. angels에 insert */

    // let start_hour = Number(req.body['start_time'].split(':')[0]);
    // let end_hour = Number(req.body['end_time'].split(':')[0]);
    let start_hour = req.body["start_time"];
    let end_hour = req.body["end_time"];
    // start = new Date(start_hour);
    // end = new Date(end_hour);
    // console.log(start, end);
    start_date = start_hour.split("T")[0].split("-");
    start_time = start_hour.split("T")[1].split(".")[0].split(":");
    end_date = end_hour.split("T")[0].split("-");
    end_time = end_hour.split("T")[1].split(".")[0].split(":");
    console.log(start_date, start_time, end_date, end_time);

    let start = [
      start_date[0],
      start_date[1],
      start_date[2],
      start_time[0],
      start_time[1],
      start_time[2],
    ];
    let end = [
      end_date[0],
      end_date[1],
      end_date[2],
      end_time[0],
      end_time[1],
      end_time[2],
    ];
    console.log("start, end, hours: ", start, end);
    start = start.map((e) => Number(e));
    end = end.map((e) => Number(e));
    start = new Date(
      start[0],
      start[1],
      start[2],
      start[3],
      start[4],
      start[5]
    ).getTime();
    end = new Date(end[0], end[1], end[2], end[3], end[4], end[5]).getTime();
    // console.log(start, end);
    let hours = (end - start) / 3600000;
    // console.log(end.getHours(), typeof end.getHours());
    // console.log(start.getHours(), typeof start.getHours());
    // console.log('start, end, hours: ',start,end, hours);

    let date = start_date.join("-");
    let time = date + " " + start_time.join(":");

    let price = req.body["price"];

    console.log(date);
    console.log(time);
    console.log(hours);
    const sql = `insert into angels (FK_angels_stores, work_date, start_time, working_hours, price, FK_angels_jobs) 
                  values(${store_id}, '${date}', '${time}', ${hours}, ${price}, ${job_id});`;
    const [result] = await con.query(sql);
    console.log(result);

    // const sql_angel = `select angel_id from angels
    //                     where FK_angels_stores = ${store_id} and start_time = '${time}' and FK_angels_jobs = ${job_id};`
    const sql_angel = `select last_insert_id() from angels limit 1;`;
    const [angel_info] = await con.query(sql_angel);
    console.log("angel: ", angel_info);
    let angel_id = angel_info[0]["last_insert_id()"];

    /* 3. push()요청 */
    /* 3-1. qualified 알바생들 거리계산 */
    const sql_store = `select name, latitude, longitude from stores where store_id = ${store_id};`;
    const [store] = await con.query(sql_store);
    let store_name = store[0]["name"];
    let store_lat = store[0]["latitude"];
    let store_lon = store[0]["longitude"];

    const sql_qualified = `select worker_id, latitude, longitude from workers 
                          where worker_id in (select FK_qualifications_workers 
                            from qualifications 
                            where FK_qualifications_stores = ${store_id});`;
    const [workers] = await con.query(sql_qualified);
    let push_workers = { range1: [], range2: [] };
    for (let worker of workers) {
      dist = getDistance(
        worker["latitude"],
        worker["longitude"],
        store_lat,
        store_lon
      );
      if (dist < 4000) {
        push_workers["range1"].push(worker["worker_id"]);
      } else if (dist < 6000) {
        push_workers["range2"].push(worker["worker_id"]);
      }
    }

    console.log("push_workers: ", push_workers);

    if (push_workers["range1"].length < 1) {
      console.log("없음");
      send_msg = "noone";
    } else {
      /* 3-2. 추출된 알바생들 token select */
      const sql_token = `select FK_permissions_workers, token from permissions 
                          where FK_permissions_workers in (${push_workers["range1"]});`;
      const [tokens] = await con.query(sql_token);

      let push_tokens = [];
      for (let token of tokens) {
        push_tokens.push(token["token"]);
      }

      console.log(push_tokens);

      /* 3-3. tokens 로 push_angel() 호출 */

      let info = {
        store_name: store_name,
        angel_id: angel_id,
      };
      push_angel(push_tokens, info);
      con.release();

      function tmp(a) {
        function closure(arg) {
          /* 푸시보내고 10초 뒤에 모집종료 함수 호출 */
          /* 그전에 매칭되면 전역변수 갱신 및 모집종료*/
          /* 모집종료가면 flag 확인하고 종료 */

          setTimeout(function () {
            stop_call(arg);
            // console.log('3초');
            // console.log(angel_id)
            // stop_call(angel_id)
          }, 5000);
        }
        closure(a);
      }
      tmp(angel_id);

      // setTimeout(()=>{console.log('3초')}, 10000);
      // setTimeout(stop_call, 3000, angel_id);
      send_msg = "success";
    }
    if (send_flag === false) {
      res.send(send_msg);
      send_flag = true;
    }
  } catch {
    con.release();
    console.log("catch");
    if (send_flag === false) {
      res.send("error");
    }
  }
});

async function stop_call(id) {
  console.log("stop_call", id);
  const con = await pool.getConnection(async (conn) => conn);

  const sql = `select FK_angels_stores, status from angels where angel_id = ${id};`;
  const [angel_info] = await con.query(sql);
  // console.log('status: ',angel_info[0]['status']);
  if (angel_info[0]["status"] === 0) {
    const sql_status = `update angels set status = 2 where angel_id = ${id};`;
    const [result_status] = await con.query(sql_status);

    /* owner_id 찾아서 push */

    const sql_token = `select FK_permissions_owners, token from permissions 
    where FK_permissions_owners in (select FK_stores_owners from stores where store_id = ${angel_info[0]["FK_angels_stores"]});`;
    const [token] = await con.query(sql_token);

    let push_token = token[0]["token"];
    console.log(push_token);
    let title = `알바천사 결과`;
    let info = {
      result: "fail",
    };

    push_noti(push_token, title, info);
    console.log("stopped");
  }

  return; // 필요함?
}

/* 
  input = {
    'angel_id' : 1
  } 
*/
angelRouter.get("/info", async (req, res) => {
  console.log("req: ", req.query);
  const con = await pool.getConnection(async (conn) => conn);

  try {
    const angel_id = req.query["angel_id"];

    /* 1. angel 데이터 꺼내고 */
    const sql_angel = `select FK_angels_stores, FK_angels_workers, start_time, working_hours, price, FK_angels_jobs 
                        from angels where angel_id = ${angel_id};`;
    const [angel_info] = await con.query(sql_angel);
    let store_id = angel_info[0]["FK_angels_stores"];
    let worker_id = angel_info[0]["FK_angels_workers"];
    let start_time = angel_info[0]["start_time"].toISOString();
    let date = start_time.split("T")[0];
    let start = Number(start_time.split("T")[1].split(":")[0]);
    let hours = angel_info[0]["working_hours"];
    let end = start + hours;
    let price = angel_info[0]["price"];
    let job_id = angel_info[0]["FK_angels_jobs"];

    console.log("angel_info: ", angel_info);
    /* 2. 알바생 name, lat, lon 꺼내고, 유형 가져오고 */
    const sql_store = `select name, latitude, longitude from stores where store_id = ${store_id};`;
    const [store_info] = await con.query(sql_store);
    const sql_worker = `select name, latitude, longitude from workers where worker_id = ${worker_id};`;
    const [worker_info] = await con.query(sql_worker);

    const sql_job = `select type from jobs where job_id = ${job_id}`;
    const [job] = await con.query(sql_job);
    let type = job[0]["type"];

    /* 3. 거리계산 해서 res */
    let dist = getDistance(
      store_info[0]["latitude"],
      store_info[0]["longitude"],
      worker_info[0]["latitude"],
      worker_info[0]["longitude"]
    );

    let result = {
      date: date,
      start_time: start + ":00",
      end_time: end + ":00",
      hours: hours,
      price: price,
      type: type,
      name: worker_info[0]["name"],
      dist: dist,
    };

    // console.log(result);
    con.release();
    res.send(result);
  } catch {
    con.release();
    res.send("error");
  }
});

module.exports = angelRouter;
// module.exports = stop_call;

/************************ function *************************/

// async function getStoreIdByOwnerId (req, res, next) {
//     console.log(req.body)
//     const con = await pool.getConnection(async conn => conn);

//     try {
//       const sql = "SELECT store_id FROM stores WHERE FK_stores_owners=?";
//       const [result] = await con.query(sql, req.body['owner_id']);
//       console.log(result);
//       req.body['store_id'] = result[0]['store_id'];
//       con.release();
//       next();
//     }
//     catch {
//       console.log('error')
//       res.send('error');
//     }
//   }

// /* type으로 jobs 테이블에서 job_id 가져오기 */
// async function getJobIdByType(req, res, next) {
//     const con = await pool.getConnection(async conn => conn);

//     try {
//       const sql = "SELECT job_id FROM jobs WHERE type=?";
//       const [result] = await con.query(sql, req.body['type']);
//       console.log(result);
//       req.body['job_id'] = result[0]['job_id'];
//       con.release();
//       next();
//     }
//     catch {
//       res.send('error');
//     }
//   }

/* owner_id로 stores 테이블에서 store id 가져오기 */
async function getStoreIdByOwnerId(req, res) {
  const con = await pool.getConnection(async (conn) => conn);

  try {
    const sql = "SELECT store_id FROM stores WHERE FK_stores_owners=?";
    const [result] = await con.query(sql, req.body["owner_id"]);
    con.release();
    const store_id = result[0]["store_id"];
    return store_id;
    //   next();
  } catch {
    res.send("error-angel/call-getStoreIdByOwnerId");
  }
}

/* type으로 jobs 테이블에서 job_id 가져오기 */
async function getJobIdByType(req, res) {
  const con = await pool.getConnection(async (conn) => conn);

  try {
    const sql = "SELECT job_id FROM jobs WHERE type=?";
    const [result] = await con.query(sql, req.body["type"]);
    con.release();
    // console.log('getjob : ', result);
    const job_id = result[0]["job_id"];
    return job_id;
    next();
  } catch {
    res.send("error-angel/call-getJobIdByType");
  }
}

/* '2022-08-20 00:00:000Z' 형식의 input을 '0000-00-00'형식으로 변환하여 리턴 */
function masageDateToYearMonthDay(date_timestamp) {
  let date = new Date(date_timestamp);
  let year = date.getFullYear().toString();
  let month = (date.getMonth() + 1).toString();
  let day = date.getDate().toString();

  if (month.length === 1) month = "0" + month;
  if (day.length === 1) day = "0" + day;

  return year + "-" + month + "-" + day;
}

/* 두 개의 좌표 간 거리 구하기 */
function getDistance(lat1, lon1, lat2, lon2) {
  if (lat1 == lat2 && lon1 == lon2) return 0;

  let radLat1 = (Math.PI * lat1) / 180;
  let radLat2 = (Math.PI * lat2) / 180;

  let theta = lon1 - lon2;
  let radTheta = (Math.PI * theta) / 180;
  let dist =
    Math.sin(radLat1) * Math.sin(radLat2) +
    Math.cos(radLat1) * Math.cos(radLat2) * Math.cos(radTheta);

  if (dist > 1) dist = 1;

  dist = Math.acos(dist);
  dist = (dist * 180) / Math.PI;
  dist = dist * 60 * 1.1515 * 1.609344 * 1000;

  if (dist < 100) dist = Math.round(dist / 10) * 10;
  else dist = Math.round(dist / 100) * 100;

  return dist;
}
