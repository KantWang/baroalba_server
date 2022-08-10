const { Router } = require("express");
const imageUploadRouter = Router();
const mysql = require("mysql2/promise");
const { upload } = require("../../../middleware/imageUpload");
const pool = require("../../../util/function");

// imageUploadRouter.post('/logo', upload('logo').single('logo'), async (req, res) => {
//     const con = await pool.getConnection(async (conn) => conn);

//     const url = req.file.key;
//     const owner_id = req.body['id'];
//     try {
//         const sql = `UPDATE stores set logo_image = "${url}" WHERE FK_stores_owners = ${owner_id}`;

//         const [result] = await con.query(sql);

//         con.release();
//         res.json({ state: 'success', url: url });
//     } catch {
//         con.release();
//         res.json({ state: 'fail' });
//     }
// });

imageUploadRouter.post(
  "/background",
  upload("background").single("background"),
  async (req, res) => {
    const con = await pool.getConnection(async (conn) => conn);
    let url;
    if (req.file){
      url = req.file.key;
    }else{
      url = "background/default_bg.png";
    }
    const owner_id = req.body["id"];
    try {
      const sql = `UPDATE stores set background_image = "${url}" WHERE FK_stores_owners = ${owner_id}`;

      const [result] = await con.query(sql);

      con.release();
      res.json({ state: "success", url: url });
    } catch {
      con.release();
      res.json({ state: "fail" });
    }
  }
);

module.exports = imageUploadRouter;
