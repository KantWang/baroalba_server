const { Router } = require("express");
const employmentRouter = Router();
const pool = require("../../util/function");
const getJob = require("../../util/getJob");
const getStore = require("../../util/getStore");
const masageDate = require("../../util/masageDate");

/* 
  input form
  {
    'owner_id': 60,
    'store_name': '보리누리',
    'type': '설거지',
    'description': '설거지 알바 모집합니다',
    'start_date': '2022-08-20',
    'end_date': '2022-08-22',
    'start_time': '10:00',
    'end_time': '14:00',
    'price': 10000 
  }
*/

// /* 1. owners 테이블에서 email로 owner_id 가져오기 */
// employmentRouter.post('/owner/employment', getOwnerIdByEmail, async (req, res, next) => { next(); })

employmentRouter.post("/", async (req, res, next) => {
  console.log("aa", req.body);
  const con = await pool.getConnection(async (conn) => conn);

  try {
    /* 2. stores 테이블에서 owner_id로 store_id 가져오기 */
    const store_id = await getStore.getStoreIdByOwnerId(req.body["owner_id"]);
    console.log("###", store_id);
    if (store_id === -1) {
      throw "error: getStoreIdByOwnerId returned -1";
    }
    /* 3. jobs 테이블에서 type으로 job_id 가져오기 */
    const job_id = await getJob.getJobIdByType(req.body["type"]);
    console.log("####", job_id);
    if (job_id === -1) {
      throw "error: getJobIdByType returned -1";
    }

    console.log(store_id, job_id);
    /* 4. orders 테이블에 INSERT */
    const sql =
      "INSERT INTO orders SET FK_orders_stores=?, request_date=?, FK_orders_jobs=?, description=?, min_price=?, status=?";
    let request_date = new Date();
    console.log(
      store_id,
      request_date,
      job_id,
      req.body["description"],
      req.body["price"]
    );
    await con.query(sql, [
      store_id,
      request_date,
      job_id,
      req.body["description"],
      req.body["price"],
      0,
    ]);
    req.body["request_date"] = request_date;
    con.release();
    next();
  } catch {
    con.release();
    console.log("error 4");
    res.send("error");
  }
});

/* 5. orders 테이블에서 request_date로 order_id 가져오기 */
employmentRouter.use("/", async (req, res, next) => {
  const con = await pool.getConnection(async (conn) => conn);

  try {
    // const sql = "SELECT order_id FROM orders WHERE request_date=?"; // 이거 request_date로 하면 안된다. 마지막 행을 읽자
    const sql = "SELECT order_id FROM orders ORDER BY order_id DESC LIMIT 1";
    /* check! */
    // 마지막 행을 읽는데 만약 여기서 다른 request가 들어와서 마지막이 아니게 된다면?
    // 그럴 수 있나? 그럴 수 있다면, 해결책은?
    const [result] = await con.query(
      sql,
      masageDate.masageDateToYearMonthDayHourMinSec(req.body["request_date"])
    );
    req.body["order_id"] = result[0]["order_id"]; // result[0]인 것 주의
    con.release();
    next();
  } catch {
    con.release();
    console.log("error 5");
    res.send("error");
  }
});

/* 6. hourly_orders 테이블에 INSERT */
employmentRouter.use("/", async (req, res) => {
  const con = await pool.getConnection(async (conn) => conn);

  /* 6-1. 총 일수 계산 */
  let start_date = new Date(req.body["start_date"]);
  let end_date = new Date(req.body["end_date"]);
  let day = Math.abs((end_date - start_date) / (1000 * 60 * 60 * 24)) + 1; // 1000ms * 60s * 60m * 24h

  /* 6-2. 시작, 끝 시간 계산 */
  let start_hour = Number(req.body["start_time"].split(":")[0]);
  let end_hour = Number(req.body["end_time"].split(":")[0]);
  let hour = end_hour - start_hour;

  /* 6-3. for문 돌면서 hourly_orders 테이블에 INSERT */
  try {
    // const sql = "INSERT INTO hourly_orders SET FK_hourlyorders_orders=?, work_date=?, start_time=?";
    const sql =
      "INSERT INTO hourly_orders (FK_hourlyorders_orders, work_date, start_time) VALUES ?";
    let order_id = req.body["order_id"];
    let date = new Date(start_date);

    /* 시간을 담은 배열 생성 */
    let all_hours = Array();
    for (let i = 0; i < hour; i++) {
      if (start_hour.toString().length === 1)
        all_hours.push("0" + (start_hour + i).toString() + ":00:00");
      else all_hours.push((start_hour + i).toString() + ":00:00");
    }

    /* check! (완료) */
    /* 매번 INSERT query를 실행하면 너무 무거울 것 같은데, INSERT 한 번에 끝내는 법을 알아보자 */
    /* 날짜 순회 */
    let insert_array = Array();
    for (let i = 0; i < day; i++) {
      date.setDate(start_date.getDate() + i);
      // let work_date = new Date(masageDateToYearMonthDay(date)); // 불필요. 그냥 string으로 넣으면 된다
      // console.log(work_date);

      /* 시간 순회 */
      for (let j = 0; j < hour; j++) {
        // let start_time = new Date(masageDateToYearMonthDay(date)+' '+all_hours[j]); // 불필요.
        insert_array.push([
          order_id,
          masageDate.masageDateToYearMonthDay(date),
          masageDate.masageDateToYearMonthDay(date) + " " + all_hours[j],
        ]);
        // await con.query(sql, [order_id, masageDateToYearMonthDay(date), masageDateToYearMonthDay(date)+' '+all_hours[j]])
      }
    }
    // console.log(insert_array);
    console.log(insert_array);
    await con.query(sql, [insert_array]);
    con.release();
    res.send("success");
  } catch {
    con.release();
    console.log("error 6");
    res.send("error");
  }
});

module.exports = employmentRouter;

/************************ function *************************/

// /* owner_id로 stores 테이블에서 store id 가져오기 */
// async function getStoreIdByOwnerId (req, res, next) {
//     console.log(req.body)
//     const con = await pool.getConnection(async conn => conn);

//     try {
//       const sql = "SELECT store_id FROM stores WHERE FK_stores_owners=?";
//       const [result] = await con.query(sql, req.body['owner_id']);
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
//       req.body['job_id'] = result[0]['job_id'];
//       con.release();
//       next();
//     }
//     catch {
//       res.send('error');
//     }
//   }

// /* '2022-08-20 00:00:000Z' 형식의 input을 '0000-00-00 00:00:00'형식으로 변환하여 리턴 */
// function masageDateToYearMonthDayHourMinSec(date_timestamp) {
//     let date = new Date(date_timestamp);
//     let hour = date.getHours().toString();
//     let min = date.getMinutes().toString();
//     let sec = date.getSeconds().toString();

//     if (hour.length === 1) hour = '0'+hour
//     if (min.length === 1) min = '0'+min
//     if (sec.length === 1) sec = '0'+sec

//     return (masageDateToYearMonthDay(date_timestamp)+' '+hour+':'+min+':'+sec);
//   }

// /* '2022-08-20 00:00:000Z' 형식의 input을 '0000-00-00'형식으로 변환하여 리턴 */
// function masageDateToYearMonthDay(date_timestamp) {
//     let date = new Date(date_timestamp);
//     let year = date.getFullYear().toString();
//     let month = (date.getMonth() + 1).toString();
//     let day = date.getDate().toString();

//     if (month.length === 1) month = '0'+month;
//     if (day.length === 1) day = '0'+day;

//     return (year+'-'+month+'-'+day);
//   }
