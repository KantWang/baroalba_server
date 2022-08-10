const { Router } = require("express");
const permissionRouter = Router();
const pool = require('../util/function');

/*
  data form === 
  {
		'id': '1',
		'user_flag': 'w or o',
		'token': 'token string'
  } */


permissionRouter.post("/", async (req, res) => {
  const con = await pool.getConnection(async (conn) => conn);
  // console.log('start: ', req.body);
  
  try{
    let id = req.body['id'];
    let type = req.body['user_flag']==='w' ? 'FK_permissions_workers' : 'FK_permissions_owners';
    let token = req.body['token'];
  
    const sql = `INSERT INTO permissions(${type}, token) VALUES(${id}, '${token}')
    ON DUPLICATE KEY UPDATE ${type} = ${id}, token = '${token}';`;
    const [result] = await con.query(sql);
    console.log('result : ', result);
    con.release();
    res.send(req.body['user_flag']);
  }
  catch{
    con.release();
    res.send('error');
  }
});

module.exports = permissionRouter; 

/************************ function *************************/
