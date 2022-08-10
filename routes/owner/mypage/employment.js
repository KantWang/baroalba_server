const { Router } = require("express");
const employmentRouter = Router();
const pool = require("../../../util/function.js");
let getJob = require("../../../util/getJob.js");
// const getTypeByJobId = require("..../../util/getJob");

/* 사장님 최저시급 설정 페이지의 모집공고 작성 버튼 || 사장님 홈 페이지의 + 버튼 */
/*
  input form
  {
    'email': 'borinuri@gmail.com',
    'owner_id': 60
  }

  output form
  {
    'name': '보리누리',
    'address': '인천 서구 심곡동 123-4',
    'type': ['서빙', '뭐시기', ...]
  }
*/

/* 1. owners 테이블에서 owner_id 가져오기 */
// app.post('/owner/mypage/employment/button', getOwnerIdByEmail, async (req, res, next) => { next(); })

/* 2. stores 테이블에서 owner_id로 name, address, store_id 가져오기 */
employmentRouter.post("/button", async (req, res, next) => {
  console.log("??", req.body);
  const con = await pool.getConnection(async (conn) => conn);

  try {
    const sql =
      "SELECT name, address, store_id FROM stores WHERE FK_stores_owners=?";
    const [result] = await con.query(sql, req.body["owner_id"]);
    const name = result[0]["name"];
    const address = result[0]["address"];
    const store_id = result[0]["store_id"];

    /* 3. store_job_lists 테이블에서 store_id로 FK_store_job_lists_jobs 모두 가져오기 */

    const jobIds = await getJob.getJobIdByStoreId(store_id);
    if (jobIds === -1) {
      throw "error: getJobIdByStoreId returned -1";
    }
    const types = await getJob.getTypeByJobId(jobIds);
    if (types.length === 0) {
      throw "error: types.length === 0";
    } else if (types === -1) {
      throw "error: getTypeByJobId returned -1";
    }

    let body = {
      name: name,
      address: address,
      types: types,
    };

    con.release();
    res.send(body);
  } catch (error) {
    console.log("!!!err!!!", error);
    con.release();
    res.send("error");
  }
});

module.exports = employmentRouter;

/************************ function *************************/

/* store_job_lists 테이블에서 store_id로 FK_store_job_lists_jobs 모두 가져오기 */
/*
  req.body['types'] === ['청소', '빨래', '설거지']
*/
// async function getJobIdByStoreId(req, res, next) {
//   const con = await pool.getConnection(async (conn) => conn);

//   try {
//     const sql =
//       "SELECT FK_store_job_lists_jobs FROM store_job_lists WHERE FK_store_job_lists_stores=?";
//     const [result] = await con.query(sql, req.body["store_id"]);

//     /* 가져온 job_id 개수만큼 for문 돌아서 배열 형태로 masage */
//     let job_ids = Array();
//     for (let i = 0; i < result.length; i++) {
//       job_ids.push(result[i]["FK_store_job_lists_jobs"]);
//     }

//     /* 배열에 담긴 job_id를 type으로 변환 */
//     try {
//       req.body["types"] = await getTypeByJobId(job_ids);
//       if (req.body["types"].length === 0)
//         throw new Error("error: getTypeByJobId");
//     } catch (exception) {
//       console.log(exception);
//     }
//     next();
//   } catch {
//     res.send("error: getJobIdByStoreId");
//   }
// }

// /* 배열에 담긴 job_id를 type으로 변환 */
// /*
//     input: [1, 2, 3, 4]
//     return: ['청소', '빨래', '설거지', '서빙']
//   */
// async function getTypeByJobId(job_ids) {
//   let job_types = Array();
//   const con = await pool.getConnection(async (conn) => conn);

//   try {
//     const sql = "SELECT type FROM jobs WHERE job_id IN (?)";
//     const [result] = await con.query(sql, [job_ids]); // [[1, 2, 3, 4]]의 형태로 넣어줘야 되네
//     for (let i = 0; i < result.length; i++) {
//       job_types.push(result[i]["type"]);
//     }
//     return job_types;
//   } catch {
//     console.log("error");
//   }
// }
