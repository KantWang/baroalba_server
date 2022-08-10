const { Router } = require('express');
const checkRouter = Router();
const pool = require('../util/function');


/* owners 테이블 체크 */
checkRouter.post('/member', async (req, res, next) => {
  const con = await pool.getConnection(async conn => conn); 
  try{
    if (await checkOwner(req.body['email']) > 0) {
      const sql = `SELECT owner_id FROM owners WHERE email='${req.body['email']}'`
      const [result] = await con.query(sql);
      let send_array = {
        'member_type':'owner', 
        'owner_id':result[0]['owner_id']
      }
      con.release();
      res.send(send_array);
    }
    else{
      next();
    } 
  }
  catch{
    con.release();
    res.send('error');
  }
});

/* workers 테이블 체크 */
checkRouter.use('/member', async (req, res) => {
  const con = await pool.getConnection(async conn => conn);
  try{
    if (await checkWorker(req.body['email']) > 0) {
      const sql = "SELECT worker_id, `range`, location FROM workers WHERE email=?"
      const [result] = await con.query(sql, req.body['email']);
      let send_array = {
        'member_type': 'worker', 
        'worker_id': result[0]['worker_id'], 
        'address': result[0]['location'],
        'range': result[0]['range']
      }
      con.release();
      res.send(send_array);
    }
    else {
      res.send(['NONE'])
    }
  }
  catch{
    con.release();
    res.send('error');
  }
});
  
module.exports = checkRouter;

/************************ function *************************/
  
/* owners 테이블에 존재하는 email이면 1, 아니면 0 */
async function checkOwner(email) {
  const con = await pool.getConnection(async conn => conn);
  
  /* 우선 owners db 확인 (더 적으니까) */
  const sql = `SELECT * FROM owners WHERE email=?`;
  const [result] = await con.query(sql, email);
  con.release();
  if (result.length > 0) return 1;
  else return 0;
}

/* workers 테이블에 존재하는 email이면 1, 아니면 0 */
async function checkWorker(email) {
  const con = await pool.getConnection(async conn => conn);

  /* 우선 owners db 확인 (더 적으니까) */
  const sql = `SELECT * FROM workers WHERE email=?`;
  const [result] = await con.query(sql, email);
  con.release();
  if (result.length > 0) return 1; 
  else return 0;
}