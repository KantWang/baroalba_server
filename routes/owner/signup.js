const { Router } = require("express");
const signupRouter = Router();
const pool = require('../../util/function');
const { getPos } = require("../../util/getDist");


 
/* 사장님 사장님 최저시급 설정 페이지 */
/* owner db에 사장님 회원정보 INSERT & store db에 가게정보 INSERT */
/* 
data form
{
	'name': 'kantwang', 
	'email': 'dngp93@gmail.com',
	'phone': '01089570356'
	'store_name': '보리누리',
	'location': '인천 서구 심곡동',
	'store_jobs': ['서빙', '카운터', '주방', '청소'],
	'background': (양식에 맞게),
	'logo': (양식에 맞게),
	'description': "보리누리 많이 사랑해주세요",
	'minimum_wage': 10200,
} 
*/
// 이거 하기 전에 들어온 데이터가 정확한지 체크하는 과정이 필요
signupRouter.post("/", async (req, res) => {
  const con = await pool.getConnection(async (conn) => conn);

  try {

    const location = await getPos(req.body['location']);
    // getPos : [latitude, longitude] 형태로 반환
    req.body["latitude"] = location[0];
    req.body["longitude"] = location[1];

    /* 먼저, owners 테이블에 name, eamil, phone INSERT */
    const sql = "INSERT INTO owners SET name=?, email=?, phone=?";
    await con.query(sql, [
      req.body["name"],
      req.body["email"],
      req.body["phone"],
    ]);

    /* 다음으로, owners 테이블에서 owner_id SELECT */
    const sql2 = "SELECT owner_id FROM owners WHERE email=?";
    const [sql2_result] = await con.query(sql2, req.body["email"]);
    console.log("얍", sql2_result);
    /* 마지막으로, stores db에 INSERT */
    let tmp = {
      FK_stores_owners: sql2_result[0]["owner_id"],
      name: req.body["store_name"],
      address: req.body["location"],
      latitude: req.body["latitude"],
      longitude: req.body["longitude"],
      description: req.body["description"],
      minimum_wage: req.body["minimum_wage"],
    };
    const sql3 = "INSERT INTO stores SET ?";
    await con.query(sql3, tmp);

    // console.log('sql2:', sql2_result[0]['owner_id']);
    // console.log('sql4:', req.body['store_name']);

    const sql4 = "SELECT store_id FROM stores WHERE FK_stores_owners=?";
    const [sql4_result] = await con.query(sql4, sql2_result[0]['owner_id'])

    // console.log('sql4:', sql4_result);
    // console.log('req:', req.body['store_jobs'][0]);

    const types = req.body['store_jobs'][0];  // 딕셔너리 배열
    const n = types.length;
    let tmp_sql = '';
    for(let i=0; i<n; i++){
      tmp_sql += `insert into store_job_lists (FK_store_job_lists_stores, FK_store_job_lists_jobs) select '${sql4_result[0]['store_id']}', job_id from jobs where type = '${types[i]['name']}';
      `;
    }
    // console.log(tmp_sql);
    const [sql5_result] = await con.query(tmp_sql);

    console.log("owner signup success!");
    con.release();
    res.send({
      owner_id: sql2_result[0]["owner_id"],
      result: "success",
    });
  } catch {
    console.log("error");
    con.release();
    res.send("error");//
  }
});

module.exports = signupRouter;

/************************ function *************************/

// /* 두 좌표 간 거리 구하기 */
// async function getPos(req, res, next) {
//   console.log(">>>>", req.body);
//   const regionLatLongResult = await geocoder.geocode(req.body["location"]);
//   const Lat = regionLatLongResult[0].latitude; //위도
//   const Long = regionLatLongResult[0].longitude; //경도
//   req.body["latitude"] = Lat;
//   req.body["longitude"] = Long;
//   next();
// }
