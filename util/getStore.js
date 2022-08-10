const { Router } = require("express");
const pool = require('./function');
  
require('dotenv').config();

/* owner_id로 stores 테이블에서 store id 가져오기 */
async function getStoreIdByOwnerId(owner_id) {
  // console.log(req.body);
  const con = await pool.getConnection(async (conn) => conn);

  try {
    const sql = "SELECT store_id FROM stores WHERE FK_stores_owners=?";
    const [result] = await con.query(sql, [owner_id]);
    con.release();
    // console.log(result[0]["store_id"]);
    return result[0]["store_id"];
  } catch {
    console.log("error");
    return -1;
  }
}

module.exports.getStoreIdByOwnerId = getStoreIdByOwnerId;
