const { Router } = require('express');
const addrRouter = Router();
const pool = require('../../util/function');

  
addrRouter.post("/range", async (req, res) => {
    // console.log(req.body["worker_id"]);
    const con = await pool.getConnection(async (conn) => conn);

    try{
      const sql = "SELECT location, `range`, name FROM workers WHERE worker_id=?";
      const [result] = await con.query(sql, req.body["worker_id"]);
      // console.log('result:', result);
      con.release();
      res.send(result);
    }
    catch{
      con.release();
      res.send('error');
    }    
});
  
module.exports = addrRouter;

/************************ function *************************/
