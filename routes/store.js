const { Router } = require("express");
const storeerRouter = Router();
const pool = require("../util/function");
const getDist = require("../util/getDist");

/* 면접 가능한 매장 정보를 return (지정 거리 이내) 
  data form === 
  {
    'worker_id': 1
  } */
  storeerRouter.post("/list", async (req, res) => {
    const con = await pool.getConnection(async (conn) => conn);
    try {
      const sql =
        "SELECT `latitude`, `longitude`, `range` FROM workers WHERE worker_id=?";
      /* 1. 해당 worker의 위도, 경도, 거리 설정 정보 가져오기 */
      const [worker_info] = await con.query(sql, req.body["worker_id"]);
      // console.log(worker_info);
  
      let cursor = Number(req.body['cursor']) || 0;
      /* 2. store 정보 모두 가져오기 */
      // 내게 권한 없는 정보만 가져와야 한다. 어떻게?
      // const sql2 =
      //   `SELECT * FROM stores WHERE store_id>? AND store_id NOT IN (SELECT FK_qualifications_stores FROM qualifications WHERE FK_qualifications_workers=?) order by store_id LIMIT 10`;
      // const [stores_info] = await con.query(sql2, [cursor, req.body["worker_id"]]);

      /* 3. 거리 계산해서 send할 배열 생성 */
      // let stores = getStore(
      //   worker_info[0]["latitude"],
      //   worker_info[0]["longitude"],
      //   worker_info[0]["range"],
      //   stores_info
      // );

      const sql2 = `SELECT * FROM stores 
                    WHERE store_id>? AND store_id NOT IN 
                    (SELECT FK_qualifications_stores FROM qualifications WHERE FK_qualifications_workers=?) 
                    order by store_id LIMIT 1`;
      let stores = new Array();
      while (1) {
        if (stores.length === 10) break;

        const [stores_info] = await con.query(sql2, [cursor, req.body["worker_id"]]);
        if (stores_info.length === 0) break;
        
        let dist = getDist.getDistance(worker_info[0]["latitude"], worker_info[0]["longitude"], stores_info[0]["latitude"], stores_info[0]["longitude"])

        if (dist < worker_info[0]["range"]) {
          stores_info[0]["distance"] = dist
          stores.push(stores_info[0])
        }
        cursor = stores_info[0]['store_id'];
      }

      // }
      // console.log(stores_info);
      
    // console.log(stores);

    con.release();
    // /* 결과를 랜덤하게 정렬 */
    // const shuffle = () => Math.random() - 0.5;
    // stores.sort(shuffle);
    if (stores.length !== 0) {
      res.send(stores);
    } else {
      res.send("notFound");
    }
  } catch {
    con.release();
    res.send("error");
  }
});

// storeerRouter.post('/list', async (req, res, next) => {
//     const con = await pool.getConnection(async conn => conn);
//     let msg = '';
//     const worker_id = req.body['worker_id'];
//     try{
//         /* 해당 worker의 위도, 경도, 거리 설정 정보 가져오기 */
//         msg = 'select range';
//         const sql ='SELECT `range` FROM workers WHERE worker_id=?';
//         const [result] = await con.query(sql, worker_id);
//         // req.body['worker_range'] = result[0]['range'];
//         console.log('result:',result);

//         msg = 'select unqualified';
//         const sql_unqualified =`select a.*, b.name, b.minimum_wage, b.distance from ${worker_id}_store_unqualified a join ${worker_id}_store_list b on a.store_id = b.list_id
//         where b.distance < ${result[0]['range']} ;`;
//         const [result_unqualified] = await con.query(sql_unqualified);
//         delete result_unqualified['list_id'];

// con.release();
//         res.send(result_unqualified);
//     }
//     catch{
// con.release();
//         res.send(`error - ${msg}`);
//     }
//   });

/* 주소 정보 전달 받아서 store table update
  data form === 
  {
    'FK_stores_owners': 2, 
    'location': '서울시 관악구 성현동'
  } */
storeerRouter.post("/address/update", async (req, res) => {
  const con = await pool.getConnection(async (conn) => conn);
  try {
    const location = await getDist.getPos(req.body['location']);
    req.body["latitude"] = location[0];
    req.body["longitude"] = location[1];

    const sql =
      "UPDATE stores SET address=?, latitude=?, longitude=? WHERE FK_stores_owners=?";

    await con.query(sql, [
    req.body["location"],
    req.body["latitude"],
    req.body["longitude"],
    req.body["FK_stores_owners"],
    ]);
    con.release();
    res.send("success");
  } catch {
    con.release();
    res.send("error");
  }
});

module.exports = storeerRouter;

/************************ function *************************/

/* worker가 설정한 반경 이내의 가게 정보를 return */
function getStore(latitude, longitude, range, stores_info) {
  const n = stores_info.length;
  // console.log(stores_info);
  let answer = new Array();
  let tmp = 0;

  /* 이렇게 짜면 너무 너무 비효율적이다 */
  /* db 구조를 바꿔야 하나? 아니면, 탐색 방식을 개선? */
  for (let i = 0; i < n; i++) {
    tmp = getDist.getDistance(
      latitude,
      longitude,
      stores_info[i]["latitude"],
      stores_info[i]["longitude"]
    );
    if (tmp <= range) {
      stores_info[i]["distance"] = tmp;
      answer.push(stores_info[i]);
    }
  }
  return answer;
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

// /* 두 좌표 간 거리 구하기 */
// async function getPos(req, res, next) {
//   const regionLatLongResult = await geocoder.geocode(req.body["location"]);
//   const Lat = regionLatLongResult[0].latitude; //위도
//   const Long = regionLatLongResult[0].longitude; //경도
//   req.body["latitude"] = Lat;
//   req.body["longitude"] = Long;
//   next();
// }
