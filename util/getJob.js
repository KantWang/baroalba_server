const { Router } = require("express");
const pool = require('./function');
  
require('dotenv').config();

/* store_job_lists 테이블에서 store_id로 FK_store_job_lists_jobs 모두 가져오기 */
/*
  req.body['types'] === ['청소', '빨래', '설거지']
*/
async function getJobIdByStoreId(store_id) {
    const con = await pool.getConnection(async (conn) => conn);
  
    try {
      const sql =
        "SELECT FK_store_job_lists_jobs FROM store_job_lists WHERE FK_store_job_lists_stores=?";
      const [result] = await con.query(sql, [store_id]);
  
      /* 가져온 job_id 개수만큼 for문 돌아서 배열 형태로 masage */
      let job_ids = Array();
      for (let i = 0; i < result.length; i++) {
        job_ids.push(result[i]["FK_store_job_lists_jobs"]);
      }
      
      return job_ids;

    } catch {
        console.log("error: getJobIdByStoreId");
        return -1;
    }
  }

  /* 배열에 담긴 job_id를 type으로 변환 */
/* 
    input: [1, 2, 3, 4]
    return: ['청소', '빨래', '설거지', '서빙']
  */
async function getTypeByJobId(job_ids) {
    let job_types = Array();
    const con = await pool.getConnection(async (conn) => conn);
  
    try {
      const sql = "SELECT type FROM jobs WHERE job_id IN (?)";
      const [result] = await con.query(sql, [job_ids]); // [[1, 2, 3, 4]]의 형태로 넣어줘야 되네
      for (let i = 0; i < result.length; i++) {
        job_types.push(result[i]["type"]);
      }
      return job_types;
    } catch {
      console.log("error");
      return -1;
    }
}

/* type으로 jobs 테이블에서 job_id 가져오기 */
async function getJobIdByType(type) {
  const con = await pool.getConnection(async (conn) => conn);

  try {
    const sql = "SELECT job_id FROM jobs WHERE type=?";
    const [result] = await con.query(sql, [type]);
    con.release();
    console.log('getjob : ', result);
    const job_id = result[0]["job_id"];
    console.log(job_id);
    return job_id;
  } catch {
    con.release();
    return -1;
  }
}


module.exports.getJobIdByStoreId = getJobIdByStoreId;
module.exports.getTypeByJobId = getTypeByJobId;
module.exports.getJobIdByType = getJobIdByType;
