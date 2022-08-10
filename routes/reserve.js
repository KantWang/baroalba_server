const { Router } = require("express");
const reserveRouter = Router();
const pool = require("../util/function");

// order_id : 1
reserveRouter.post("/load_store", async (req, res) => {
  const con = await pool.getConnection(async (conn) => conn);
  let order_id = req.body["order_id"];
  store = {};
  try{
    const sql_order = `SELECT FK_orders_stores FROM orders where order_id = ${order_id};`;
    const [order_info] = await con.query(sql_order);
    store_id = order_info[0]["FK_orders_stores"];
    // console.log('store: ', store_id);
  
    const sql_store = `SELECT FK_stores_owners, name, address, description, logo, background, background_image FROM stores WHERE store_id = ${store_id}`;
    const [store_info] = await con.query(sql_store);
    // console.log(store_info[0]['name']);
    owner_id = store_info[0]["FK_stores_owners"];
    // console.log('owner: ', owner_id);
    // console.log(store_info);
  
    store["name"] = store_info[0]["name"];
    store["address"] = store_info[0]["address"];
    store["description"] = store_info[0]["description"];
    store["logo"] = store_info[0]["logo"];
    store["background"] = store_info[0]["background"];
    store["background_image"] = store_info[0]["background_image"];
  
    const sql_owner = `SELECT name, phone FROM owners WHERE owner_id = ${owner_id}`;
    const [owner_info] = await con.query(sql_owner);
    store["owner_name"] = owner_info[0]["name"];
    store["owner_phone"] = owner_info[0]["phone"];
    // console.log(store);
    con.release();
    res.send(store);
  }
  catch{
    con.release();
    res.send('error');
  }
});

module.exports = reserveRouter;

/************************ function *************************/
