const { Router } = require("express");
const pool = require('./function');
  
require('dotenv').config();

/* store_id에 해당하는 모든 worker_id를 배열로 return */
async function getWorkerIdByStoreId(store_id) {
    const con = await pool.getConnection(async (conn) => conn);
    try{
        const sql = `SELECT FK_qualifications_workers AS worker_id FROM qualifications WHERE FK_qualifications_stores='${store_id}'`;
        const [result] = await con.query(sql);
        console.log(result);
        let worker_ids = new Array();
        for (let i = 0; i < result.length; i++) {
          worker_ids.push(result[i]["worker_id"]);
        }
      
        con.release();
        if (worker_ids.length === 0) return -1;
        return worker_ids;
    }
    catch{
        con.release();
        return -1;
    }
}
  

module.exports.getWorkerIdByStoreId = getWorkerIdByStoreId;
