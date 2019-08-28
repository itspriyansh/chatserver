var express = require('express');
var router = express.Router();
var User = require('../models/users');
var Chat = require('../models/chats');
var passport = require('passport');
var auth = require('../authenticate');
var RSA = require('./rsa');

/* GET users listing. */
router.get('/', auth.verifyUser, function(req, res, next) {
  res.statusCode=200;
  res.setHeader('Content-Type', 'application/json');
  res.json(req.user);
});

router.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if(err) return next(err);
    if (!user) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.json({success: false, status: 'Login Unsuccessful!', err: info});
    }
    req.logIn(user, (err) => {
      if(err){
        res.status=401;
        res.setHeader('Content-Type', 'application/json');
        res.json({success: false, status: 'Login Unsuccessful!', err: 'Could not log in user!'});
        return;
      }
      let token = auth.getToken({_id: req.user._id});
      Chat.find({members: req.user._id}).then((chats) => {
        chats.forEach(chat => {
          chat.messages.forEach(async (message) => {
            if(message.keys.has(req.user._id)){
              //decrypt using old private key
              //encrypt using new public key
              message.keys[req.user._id] = RSA.Encryption(RSA.Decryption(message.keys[req.user._id], {
                private: req.user.private,
                n: req.user.n
              }), {
                public: req.body.public,
                n: req.body.n
              });
              await chat.save();
            }
          });
        });
        return;
      }).then(() =>{
        return User.findByIdAndUpdate(req.user._id, {
          public: req.body.public,
          private: req.body.private,
          n: req.body.n
        },{ new: true });
      }).then((user) => {
        req.user = user;
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.json({success: true, status: 'Login Successful!', token: token});
      },(err) => next(err)).catch((err) => next(err));
    });
  })(req,res,next);
});

router.post('/signup', (req, res, next) => {
  if(!req.body.lastname){
    req.body.lastname='';
  }
  User.register(new User({
    username: req.body.phone,
    firstname: req.body.firstname,
    lastname: req.body.lastname,
    email: req.body.email,
    public: req.body.public,
    private: req.body.private,
    n: req.body.n
  }), req.body.password, (err, user) => {
    if(err) return next(err);
    else{
      req.logIn(user, (err) => {
        if(err){
          res.status=401;
          res.setHeader('Content-Type', 'application/json');
          res.json({success: false, status: 'Registered but Login Unsuccessful!', err: 'Could not log in user!'});
        }
        res.statusCode=200;
        res.setHeader('Content-Type', 'application/json');
        res.json({success: true, status: 'Registration Successful!', token: auth.getToken({_id: req.user._id})});
      });
    }
  });
});

module.exports = router;
