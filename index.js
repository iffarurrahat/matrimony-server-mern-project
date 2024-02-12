const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId, } = require('mongodb');
require('dotenv').config();
const jwt = require('jsonwebtoken')
const app = express();
const port = process.env.PORT || 5000;


// middleware
const corsOptions = {
    origin: ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true,
    optionSuccessStatus: 200,
}
app.use(cors(corsOptions))
app.use(express.json())

const verifyToken = async (req, res, next) => {
    const token = req.cookies?.token
    console.log(token)
    if (!token) {
        return res.status(401).send({ message: 'unauthorized access' })
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            console.log(err)
            return res.status(401).send({ message: 'unauthorized access' })
        }
        req.user = decoded
        next()
    })
}


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(process.env.DB_URI, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
})


async function run() {
    try {

        const reviewCollection = client.db("matrimonyDB").collection("reviews");
        const usersCollection = client.db("matrimonyDB").collection("users");
        const candidatesCollection = client.db("matrimonyDB").collection("candidates");

        // <-!---- reviews get---->
        app.get('/reviews', async (req, res) => {
            const result = await reviewCollection.find().toArray();
            res.send(result)
        })

        // auth related api
        app.post('/jwt', async (req, res) => {
            const user = req.body
            // console.log('I need a new jwt', user)
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '365d',
            })
            res
                .cookie('token', token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
                })
                .send({ success: true })
        })

        app.put('/users/:email', async (req, res) => {
            const email = req.params.email
            const user = req.body
            const query = { email: email }
            const options = { upsert: true }
            const isExist = await usersCollection.findOne(query)
            // console.log('User found?----->', isExist)
            if (isExist) {
                if (user?.status === 'Requested') {
                    const result = await usersCollection.updateOne(
                        query,
                        {
                            $set: user,
                        },
                        options,
                    )
                    return res.send(result)
                }
                else {
                    return res.send(isExist)
                }
            }
            const result = await usersCollection.updateOne(
                query,
                {
                    $set: { ...user, timestamp: Date.now() },
                },
                options
            )
            res.send(result)
        })

        // Get user role
        app.get('/user/:email', async (req, res) => {
            const email = req.params.email
            const result = await usersCollection.findOne({ email })
            res.send(result)
        })

        // Get all users
        app.get('/users', async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result)
        })

        // Updated User role
        app.put('/users/update/:email', async (req, res) => {
            const email = req.params.email
            const user = req.body;
            const query = { email: email }
            const option = { upsert: true }
            const updateDoc = {
                $set: {
                    ...user,
                    timestamp: Date.now(),
                }
            }
            const result = await usersCollection.updateOne(query, updateDoc, option)
            res.send(result)
        })


        // Get all candidates
        app.get('/candidates', async (req, res) => {
            const result = await candidatesCollection.find().toArray();
            res.send(result);
        })

        // get candidates for host
        app.get('/candidates/:email', async (req, res) => {
            const email = req.params.email;
            const result = await candidatesCollection.find({ 'host.email': email }).toArray();
            res.send(result);
        })

        // Get single candidate data
        app.get('/candidate/:id', async (req, res) => {
            const id = req.params.id;
            const result = await candidatesCollection.findOne({ _id: new ObjectId(id) });
            res.send(result);
        })

        // Save a candidates in database
        app.post('/candidates', async (req, res) => {
            const candidate = req.body;
            const result = await candidatesCollection.insertOne(candidate)
            res.send(result);
        })




        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Matrimony server is running')
})

app.listen(port, () => {
    console.log(`Matrimony server running on PORT: ${port}`);
})