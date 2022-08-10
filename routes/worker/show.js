const { Router } = require("express");
const showRouter = Router();
const pool = require("../../util/function");

let util = require("util");
const { request } = require("http");
const getDist = require("../../util/getDist");

module.exports = showRouter;

/* { 'worker_id': 1, 'cursor': null } cursor는 store_id */
/*
    [ 정상적 형태 ]
    [
      {
        "name": "보리누리",
        "distance": 3991000,
        "types": ["카운터", "청소"],
        "orders": [
            { "order_id":5, "type":"카운터", "price":10000, "work_date": "2022-08-20" },
            { ... }
        ]
      },
    ]
*/
/* 1. worker의 range를 가져오자 */
showRouter.post("/hourly_orders", async (req, res, next) => {
  console.log("cursor: ", req.body["cursor"]);
  const con = await pool.getConnection(async (conn) => conn);
  const sql =
    "SELECT `range`, latitude, longitude FROM workers WHERE worker_id=? LIMIT 1";

  const [worker_info] = await con.query(sql, [req.body["worker_id"]]);
  con.release();
  req.body["range"] = worker_info[0]["range"];
  req.body["latitude"] = Number(worker_info[0]["latitude"]);
  req.body["longitude"] = Number(worker_info[0]["longitude"]);

  next();
});

/* 2. worker가 설정한 거리 안에 있는 store 정보를 모두 가져오자 */
showRouter.use("/hourly_orders", async (req, res, next) => {
  const con = await pool.getConnection(async (conn) => conn);
  const sql = `SELECT store_id, FK_stores_owners AS owner_id, name, address, latitude, longitude FROM stores WHERE store_id IN (SELECT FK_qualifications_stores AS store_id FROM qualifications WHERE FK_qualifications_workers='${req.body['worker_id']}')`;
  const [result] = await con.query(sql);

  con.release();

  let store_list = new Array();
  let store_ids = new Array();
  let worker_range = req.body["range"];
  let worker_latitude = req.body["latitude"];
  let worker_longitude = req.body["longitude"];

  for (let i = 0; i < result.length; i++) {
    let tmp = await getDist.getDistance(
      worker_latitude,
      worker_longitude,
      result[i]["latitude"],
      result[i]["longitude"]
    );

    if (worker_range > tmp) {
      result[i]["distance"] = tmp;
      store_list.push(result[i]);
      store_ids.push(result[i]["store_id"]);
    }
  }

  req.body["store_list"] = store_list;
  req.body["store_ids"] = store_ids;
  // console.log(req.body['store_list'])
  next();
});

/* 3. order를 가져올건데, 가져온 store에 해당하는 것만! */
showRouter.use("/hourly_orders", async (req, res, next) => {
  const con = await pool.getConnection(async (conn) => conn);
  let store_list = req.body["store_list"];
  let store_ids = req.body["store_ids"];
  let store_ids_idx = store_ids.indexOf(Number(req.body["cursor"])) + 1 || 0;
  try {
    const sql = `SELECT order_id, FK_orders_jobs AS job_id, description, min_price 
                  FROM orders 
                  WHERE FK_orders_stores=? AND status=0`;
    // [ 정상적 형태 ]
    // "name": "보리누리",
    // "distance": 3991000,
    // "types": ["카운터", "청소"],
    // "orders": [
    //     { "order_id":5, "type":"카운터", "price":10000, "work_date": "2022-08-20" },
    //     { ... }
    // ]
    let count = 0;
    // let store_orders = new Array();
    let valid_hourly_orders = new Array();
    for (let i = store_ids_idx; i < store_ids.length; i++) {
      if (count === 5) break;

      const [orders] = await con.query(sql, store_ids[i]);
      if (orders.length > 0) {
        // 유효한 매장

        for (let j = 0; j < orders.length; j++) {
          const sql2 = `SELECT A.hourlyorders_id, A.FK_hourlyorders_workers, A.work_date, A.start_time, B.order_id, B.description, B.min_price, C.store_id, C.FK_stores_owners, C.name, C.address, C.latitude, C.longitude, C.minimum_wage, C.background_image, D.job_id, D.type 
                        FROM hourly_orders A
                        INNER JOIN orders B ON A.FK_hourlyorders_orders=B.order_id
                        INNER JOIN stores C ON B.FK_orders_stores=C.store_id
                        INNER JOIN jobs D ON B.FK_orders_jobs=D.job_id
                        WHERE FK_hourlyorders_orders=${orders[j]["order_id"]} AND A.status=0 AND B.status=0`;
          const [hourly_orders] = await con.query(sql2);
          // console.log(hourly_orders)
          // orders[j]["hourly_orders"] = hourly_orders;
          valid_hourly_orders = valid_hourly_orders.concat(hourly_orders);
        }
        // store_orders.push({
        //   store_id: store_ids[i],
        //   name: store_list[i]["name"],
        //   address: store_list[i]["address"],
        //   distance: req.body["distance"],
        //   types: [],
        //   orders: orders,
        // });
        // console.log(store_orders[count]['orders'])
        // console.log('-----')
        count += 1;
      }
    }

    const data = masage_data(
      req.body["latitude"],
      req.body["longitude"],
      req.body["range"],
      valid_hourly_orders
    );
    // console.log(data);
    /* 4. store의 job을 모두 가져오자 */
    // const sql3 = `SELECT B.type
    //                 FROM store_job_lists A
    //                 INNER JOIN jobs B ON A.FK_store_job_lists_jobs = B.job_id
    //                 WHERE A.FK_store_job_lists_stores=?`;

    // for (let k = 0; k < store_orders.length; k++) {
    //   const [jobs] = await con.query(sql3, store_orders[k]["store_id"]);
    //   for (let l = 0; l < jobs.length; l++) {
    //     store_orders[k]["types"].push(jobs[l]["type"]);
    //   }
    // }
    con.release();
    if (data.length === 0) res.send("notFound");
    else res.send(data);
  } catch {
    res.send("error");
  }

  // res.send(store_orders);
});

/************************ function *************************/
/* 주변일감 페이지 */
/* front에 전달할 data 전처리 */
function masage_data(latitude, longitude, range, data) {
  let d;
  let len = data.length;
  let databox = [];
  let check = {};
  let count = 0;

  for (let i = 0; i < len; i++) {
    d = data[i];

    /* 가게 이름이 없으면 새로 만들기 */
    if (!check.hasOwnProperty(d["name"])) {
      let distance = getDist.getDistance(
        latitude,
        longitude,
        d["latitude"],
        d["longitude"]
      );
      if (distance > range) continue; // range 범위 밖이면 pass

      databox.push({
        name: d["name"],
        store_id: d["store_id"],
        minimum_wage: d["minimum_wage"],
        distance: distance,
        background_image: d["background_image"],
        key: [],
        work_date_and_type_and_id: {},
      });
      check[d["name"]] = count;
      count += 1;
    }

    /* work_date_and_type가 없으면 새로 만들기 */
    if (
      !databox[check[d["name"]]]["work_date_and_type_and_id"].hasOwnProperty([
        d["work_date"],
        d["type"],
        d["order_id"],
      ])
    ) {
      databox[check[d["name"]]]["work_date_and_type_and_id"][
        [d["work_date"], d["type"], d["order_id"]]
      ] = {
        min_price: d["min_price"],
        // 'max_price': d['max_price'],
        start_time_and_id: Array(),
      };

      /* 이렇게라도 검색할 수 있게 key 목록을 주자.. */
      let date = new Date(d["work_date"]);
      let n = date.getTimezoneOffset();
      databox[check[d["name"]]]["key"].push([
        d["work_date"],
        d["type"],
        d["order_id"],
      ]);
    }

    /* minimum_price 업데이트 하기 */
    if (databox[check[d["name"]]]["minimum_wage"] < d["min_price"]) {
      databox[check[d["name"]]]["minimum_wage"] = d["min_price"];
    }

    /* start_time이 없으면 새로 만들기 */
    if (
      !databox[check[d["name"]]]["work_date_and_type_and_id"][
        [d["work_date"], d["type"], d["order_id"]]
      ]["start_time_and_id"].hasOwnProperty([
        d["start_time"],
        d["hourlyorders_id"],
      ])
    ) {
      databox[check[d["name"]]]["work_date_and_type_and_id"][
        [d["work_date"], d["type"], d["order_id"]]
      ]["start_time_and_id"].push([d["start_time"], d["hourlyorders_id"]]);
    }
  }
  // console.log(util.inspect(databox, { depth: 20 }));

  /* 결과를 랜덤하게 정렬 (하지 않겠음. 무한스크롤 구현과 충돌) */
  // const shuffle = () => (Math.random() - 0.5);
  // databox.sort(shuffle)
  // databox.sort(function(a, b) {
  //     var distance_A = a.distance;
  //     var distance_B = b.distance;

  //     if (distance_A < distance_B) return -1;
  //     if (distance_A > distance_B) return 1;
  //     return 0;
  // })

  for (let i = 0; i < databox.length; i++) {
    databox[i]['key'].sort(function(a, b) {
      var date_a = a[0];
      var date_b = b[0];
  
      if (date_a < date_b) return -1;
      if (date_a > date_b) return 1;
      return 0;
    })
  }


  // console.log('마사지 data: ', databox);
  return databox;
}

// /* 두 개의 좌표 간 거리 구하기 */
// function getDistance(lat1, lon1, lat2, lon2) {
//   if (lat1 == lat2 && lon1 == lon2) return 0;

//   let radLat1 = (Math.PI * lat1) / 180;
//   let radLat2 = (Math.PI * lat2) / 180;

//   let theta = lon1 - lon2;
//   let radTheta = (Math.PI * theta) / 180;
//   let dist =
//     Math.sin(radLat1) * Math.sin(radLat2) +
//     Math.cos(radLat1) * Math.cos(radLat2) * Math.cos(radTheta);

//   if (dist > 1) dist = 1;

//   dist = Math.acos(dist);
//   dist = (dist * 180) / Math.PI;
//   dist = dist * 60 * 1.1515 * 1.609344 * 1000;

//   if (dist < 100) dist = Math.round(dist / 10) * 10;
//   else dist = Math.round(dist / 100) * 100;

//   return dist;
// }
