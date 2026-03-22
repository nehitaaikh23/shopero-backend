import express from "express";
import mongoose from "mongoose";
import jwt from "jsonwebtoken"
import multer from "multer";
import path from "path";
import cors from "cors";
import { type } from "os";
import { error, log } from "console";
import dotenv from 'dotenv'

const port = process.env.PORT || 4000;
const app = express();


app.use(express.json());
app.use(cors());
dotenv.config();


// Database Connection with MongoDB

mongoose.connect(`${process.env.MONGO_URI}`);

//API Endpoints

app.get('/',(req, res) => {
    res.send('Express app is running')
})

// Image storage engine

const storage = multer.diskStorage({
    destination: './upload/images',
    filename: (req,file,cb) => {
        return cb(null,`${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`)
    }
})

const upload = multer({storage: storage})

// Upload endpoint for images
app.use('/images',express.static('upload/images'));

app.post("/upload", upload.single('product'), (req, res) =>{ 
    res.json({
        success: true,
        img_url: `${process.env.BASE_URL}/images/${req.file.filename}`
    })
})

//Schema for Creating Products for Mongoose
const Product = mongoose.model("Product",{
    id: {
        type: Number,
        required: true
    },
    name:{
        type: String,
        required: true,
    },
    image: {
        type: String,
        required: true,
    },
    category: {
        type: String,
        required: true,
    },
    new_price: {
        type: Number,
        required: true,
    },
    old_price: {
        type: Number,
        required: true,
    },
    date: {
        type: Date,
        default: Date.now(),
    },
    available: {
        type: Boolean,
        default: true
    }
})

//API for adding products

app.post("/addproduct", async (req, res) => {
    let products =  await Product.find({});
    let id;
    if(products.length > 0){
        let last_product_array = products.slice(-1)
        let last_product = last_product_array[0]
        id = last_product.id + 1
    } else {
        id=1
    }

    const product = new Product({
        id: id,
        name: req.body.name,
        image: req.body.image,
        category: req.body.category,
        new_price: req.body.new_price,
        old_price: req.body.old_price,
    })
    console.log(product);
    await product.save();
    console.log('Saved')
    res.json({
        success: true,
        name: req.body.name
    })
})

//API for removing products from Database

app.post("/removeproduct", async(req, res) => {
    await Product.findOneAndDelete({id:req.body.id})
    console.log('removed');
    res.json({
        success: true,
        name: req.body.name,
    })
})

// API for getting all products from database

app.get("/allproducts", async(req,res) => {
    let products = await Product.find({})
    console.log("All Products Fetched");
    res.send(products);
})

//API for getting single product from database

app.post("/editproductentry", async(req,res) => {
    let productId = req.body.id;
    let productInfo = await Product.findOne({id:productId})
    console.log(productInfo);
    res.send(productInfo);
})


// API for updating product information

app.post("/updateproduct",async(req,res)=> {
    const {id, ...updates} = req.body;
    const updatedProduct = await Product.findOneAndUpdate({id: id},{$set: updates},{new:true});

    if(!updatedProduct){
        res.status(404).json({errors: "Product Not Found"});
    }

    res.json({
        success: true,
        product: updatedProduct,
    })
})

// Creating Endpoint for New Collection Data

app.get("/newcollections", async(req, res) => {
    let products = await Product.find({});
    let newcollection = products.slice(1).slice(-8);
    console.log("new collection fetched")
    res.send(newcollection);
})

//Creating endpoint for popular data

app.get('/popularinwomen', async(req, res) => {
    let products = await Product.find({category: "women"});
    let popularProducts = products.slice(0,4);
    console.log("popular products fetched");
    res.send(popularProducts)
})

//Creating middleware to fetch user

const fetchUser = async (req, res, next) => {
    const token = req.header('auth-token');
    if(!token){
        res.status(401).send({errors: "Please authenticate using valid token"})
    } else {
        try {
            const data = jwt.verify(token,`${process.env.JWT_SECRET}`)
            req.user = data.user;
            next();
        } catch (error) {
            res.status(401).send({errors: 'Please authenticte using valid token'})
        }
    }
}

//API for sending cart data to DB

app.post('/addtocart', fetchUser, async(req, res) => {
    let userData = await Users.findOne({_id:req.user.id});
    userData.cartData[req.body.itemId] += 1;
    await Users.findOneAndUpdate({_id:req.user.id},{cartData:userData.cartData})
    res.send("Added");
})

//API for removing items from cart

app.post('/removefromcart', fetchUser, async(req, res) => {
    let userData = await Users.findOne({_id:req.user.id});
    if(userData.cartData[req.body.itemId]>0){
        userData.cartData[req.body.itemId] -= 1;
        await Users.findOneAndUpdate({_id:req.user.id},{cartData:userData.cartData})
    res.send("removed")};
});

//API for getting cart data from database

app.post('/getcart', fetchUser, async(req,res) => {
    let userData = await Users.findOne({_id:req.user.id});
    res.send(userData.cartData)
   
})

// Creating Schema for Users

const Users = mongoose.model('Users', {
    name:{
        type: String,
    },
    email:{
        type: String,
        unique: true,
    },
    password:{
        type: String,
    },
    cartData:{
        type: Object,
    },
    date: {
        type: Date,
        default: Date.now(),
    }
})

//Creating endpoint for Registering the User 

app.post('/signup', async(req, res) => {
    let check = await Users.findOne({email: req.body.email});

    if (check) {
        return res.status(400).json({success:false, error: "That email has been registered."})
    }

    let cart = {};

    for (let i = 0; i<300; i++){
        cart[i] = 0;
    }

    const user = new Users({
        name: req.body.username,
        email: req.body.email,
        password: req.body.password,
        cartData: cart,
    })

    await user.save();

    const data = {
        user: {
            id: user.id
        }
    }

    const token = jwt.sign(data, `${process.env.JWT_SECRET}`, {expiresIn: "3h"});
    res.json({success:true, token})
})

//API for User Login

app.post("/login", async (req, res) => {
    let user = await Users.findOne({email: req.body.email})

    if (user) {
        const passCompare = req.body.password === user.password;
        if (passCompare) {
            const data = {
                user: {
                    id: user.id,
                }
            }

        const token = jwt.sign(data, `${process.env.JWT_SECRET}`, {expiresIn:"3h"});
        res.json({success:true, token})
        } else {
        res.json({
            success: false,
            errors: "Wrong Password. Try Again!"
        })
    }
    } else {
        res.json({sucess:false, errors: "Wrong E-mail"})
    }
})


app.listen(port,(error)=>{
    if (!error) {
        console.log(`Server running on port ${port}`)
    } else {
        console.log('Error: ' + error)
    }
})

//API For creating schema for User model


