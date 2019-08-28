var Chat = require('../models/chats');
var express = require('express');
var bodyParser = require('body-parser');
var auth = require('../authenticate');
var User = require('../models/users');

let router = express.Router();
router.use(bodyParser.json());
module.exports = (io) => {
    router.route('/')
    .get(auth.verifyUser, (req, res, next) => {
        Chat.find({members: req.user._id})
        .select('_id name members modifiedAt messages')
        .populate({path: 'members', select: '-private'})
        .then((chats) => {
            chats.forEach((chat) => {
                chat.messages = chat.messages.filter((message) => message.queue.indexOf(req.user._id)!=-1);
                chat.messages.forEach(message => {
                    message.key = message.keys[req.user._id];
                    message.keys = undefined;
                });
            });
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.json(chats);
        },(err) => next(err)).catch((err) => next(err));
    }).post(auth.verifyUser, (req, res, next) => {
        User.find({$and: [{username: req.body.members}, {_id: {$ne: req.user._id}}]})
        .select('_id')
        .then((users) => {
            users = users.map((user) => user._id);
            if(users.length<1){
                let err = new Error('Member/s not found');
                err.status=404;
                return next(err);
            }
            users.unshift(req.user._id);
            if(users.length==2){
                req.body.name = null;
            }else{
                req.body.personal = false;
            }
            req.body.members = users;
            Chat.findOne({
                personal: true,
                members: users
            }).then((chat) => {
                if(chat){
                    let err = new Error('Chat Creation Forbidden');
                    err.status=401;
                    return next(err);
                }
                Chat.create(req.body)
                .then((chat) => {
                    Chat.findById(chat._id)
                    .populate({path: 'members', select: '-private'})
                    .then((chat) => {
                        chat.members.forEach(member => io.emit(member._id, {chat: chat}));
                        res.statusCode = 200;
                        res.setHeader('Content-Type', 'application/json');
                        res.json(chat);
                    },(err) => next(err)).catch((err) => next(err));
                },(err) => next(err)).catch((err) => next(err));
            },(err) => next(err)).catch((err) => next(err));
        });
    });

    router.route('/:chatId')
    .get(auth.verifyUser, (req, res, next) => {
        Chat.findOne({
            _id: req.params.chatId,
            members: req.user._id
        })
        .populate('members').populate({path: 'messages.from', select: 'firstname lastname email _id username'})
        .then((chat) => {
            if(!chat){
                let err = new Error('Chat '+req.params.chatId+' not found!');
                err.status=404;
                return next(err);
            }
            for(let i=chat.messages.length-1;i>=0;i--){
                if(chat.messages[i].queue.indexOf(req.user._id)!=-1){
                    chat.messages[i].queue.splice(chat.messages[i].queue.indexOf(req.user._id),1);
                }else break;
            }
            return chat.save();
        }).then((chat) => {
            chat.messages = chat.messages.filter(message => message.keys.has(req.user._id.toString())).map(message => {
                message.key = message.keys[req.user._id];
                message.keys = undefined;
                let dx = message.queue.indexOf(req.user._id);
                if(dx!=-1) message.queue.splice(dx,1);
                return message;
            });
            res.statusCode=200;
            res.setHeader('Content-Type', 'application/json');
            res.json(chat);
        },(err) => next(err)).catch((err) => next(err));
    }).delete(auth.verifyUser, (req, res, next) => {
        Chat.findOne({
            _id: req.params.chatId,
            members: req.user._id,
            personal: true
        })
        .then((chat) => {
            if(!chat){
                let err = new Error('Chat '+req.params.chatId+' not found!');
                err.status=404;
                return next(err);
            }
            for(let i=chat.messages.length-1;i>=0;i--){
                if(chat.messages[i].keys.has(req.user._id.toString())){
                    if(chat.messages[i].keys.size==1){
                        chat.messages.splice(i,1);
                    }
                    else{
                        chat.messages[i].keys.delete(req.user._id);
                        let dx = chat.messages[i].queue.indexOf(req.user._id);
                        if(dx!=-1) chat.messages[i].queue.splice(dx,1);
                    }
                }
            }
            if(chat.messages.length!=0) return chat.save();
            else return chat.remove();
        }).then(() => {
            res.statusCode=200;
            res.setHeader('Content-Type', 'application/json');
            res.json({success: true, message: 'Chat '+req.params.chatId+' deleted!'});
        },(err) => next(err)).catch((err) => next(err));
    });

    router.post('/:chatId/addMembers', auth.verifyUser, (req, res, next) => {
        Chat.findOne({
            _id: req.params.chatId,
            members: req.user._id,
            personal: false
        }).populate({path: 'members', select: '_id username'})
        .then((chat) => {
            if(!chat){
                let err = new Error('Chat '+req.params.chatId+' not found!');
                err.status=404;
                return next(err);
            }
            chat.members.forEach(member => {
                req.body.members.push(member.phone);
            });
            User.find({username: req.body.members})
            .select('_id')
            .then((users) => {
                chat.members = users.map(user => user._id);
                chat.save().then((chat) => {
                    Chat.findById(chat._id)
                    .populate('members').populate({path: 'messages.from', select: 'firstname lastname email _id username'})
                    .then((chat) => {
                        res.statusCode=200;
                        res.setHeader('Content-Type', 'application/json');
                        res.json(chat);
                    },(err) => next(err)).catch((err) => next(err));
                },(err) => next(err)).catch((err) => next(err));
            },(err) => next(err)).catch((err) => next(err));
        },(err) => next(err)).catch((err) => next(err));
    });

    router.delete('/:chatId/leaveGroup', auth.verifyUser, (req, res, next) => {
        Chat.findOne({
            _id: req.params.chatId,
            members: req.user._id,
            personal: false
        }).then((chat) => {
            if(!chat){
                let err = new Error('Chat '+req.params.chatId+' not found!');
                err.status=404;
                return next(err);
            }
            for(let i=0;i<chat.members.length;i++){
                if(chat.members[i]==req.user._id.toString()){
                    chat.members.splice(i,1);
                    break;
                }
            }
            chat.save();
        })
        .then(() => {
            res.statusCode=200;
            res.setHeader('Content-Type', 'application/json');
            res.json({success: true, message: 'Successfully left the Group!'});
        },(err) => next(err)).catch((err) => next(err));
    });

    router.post('/:chatId/send', auth.verifyUser, (req, res, next) => {
        Chat.findOne({
            _id: req.params.chatId,
            members: req.user._id
        }).then((chat) => {
            if(!chat){
                let err = new Error('Chat '+req.params.chatId+' not found!');
                err.status=404;
                return next(err);
            }
            chat.messages.push({
                from: req.user._id,
                message: req.body.message,
                keys: req.body.keys,
                queue: chat.members.filter(member => member!=req.user._id)
            });
            chat.save()
            .then((chat) => {
                Chat.findById(chat._id)
                .populate('members').populate({path: 'messages.from', select: 'firstname lastname email _id username'})
                .then((chat) => {
                    chat.messages[chat.messages.length-1].key = chat.messages[chat.messages.length-1].keys[req.user._id];
                    chat.messages[chat.messages.length-1].keys=undefined;
                    io.emit(req.params.chatId, {message: chat.messages[chat.messages.length-1]});
                    res.statusCode=200;
                    res.setHeader('Content-Type', 'application/json');
                    res.json({success: true, message: "Message Sent"});
                },(err) => next(err)).catch((err) => next(err));
            },(err) => next(err)).catch((err) => next(err));
        },(err) => next(err)).catch((err) => next(err));
    });
    router.route('/:chatId/messages/:messageId')
    .get(auth.verifyUser, (req, res, next) => {
        Chat.findOne({
            _id: req.params.chatId,
            members: req.user._id
        }).then((chat) => {
            if(!chat){
                let err = new Error('Chat '+req.params.chatId+' not found!');
                err.status=404;
                return next(err);
            }
            let idx = -1;
            for(let i=0;i<chat.messages.length;i++){
                if(chat.messages[i]._id==req.params.messageId){
                    if(chat.messages[i].keys.has(req.user._id.toString())){
                        idx=i;
                    }
                    break;
                }
            }
            if(idx==-1){
                let err = new Error('Message '+req.params.messageId+' not found!');
                err.status=404;
                return next(err);
            }let dx = chat.messages[idx].queue.indexOf(req.user._id);
            if(dx!=-1) chat.messages[idx].queue.splice(dx,1);
            Chat.findById(chat._id)
            .populate({path: 'messages.from', select: 'firstname lastname email _id username'})
            .then((chat) => {
                chat.message[idx].key = chat.messages[idx].keys[req.user._id];
                chat.messages[idx].key = undefined;
                res.statusCode=200;
                res.setHeader('Content-Type', 'application/json');
                res.json(chat.messages[idx]);
            },(err) => next(err)).catch((err) => next(err));
        }, (err) => next(err)).catch((err) => next(err));
    }).delete(auth.verifyUser, (req, res, next) => {
        Chat.findOne({
            _id: req.params.chatId,
            members: req.user._id
        }).then((chat) => {
            if(!chat){
                let err = new Error('Chat '+req.params.chatId+' not found!');
                err.status=404;
                return next(err);
            }
            let idx = -1;
            for(let i=0;i<chat.messages.length;i++){
                if(chat.messages[i]._id==req.params.messageId){
                    if(chat.messages[i].keys.hsa(req.user._id)){
                        idx=i;
                    }
                    break;
                }
            }
            if(idx==-1){
                let err = new Error('Message '+req.params.messageId+' not found!');
                err.status=404;
                return next(err);
            }
            if(chat.messages[idx].keys.size==1){
                chat.messages.splice(idx,1);
            }else{
                chat.messages[idx].keys.delete(req.user._id);
            }
            chat.save()
            .then(() => {
                res.statusCode=200;
                res.setHeader('Content-Type', 'application/json');
                res.json({success: true, message: 'Message '+req.params.messageId+' from Chat '+req.params.chatId+' successfully deleted!'});
            },(err) => next(err)).catch((err) => next(err));
        },(err) => next(err)).catch((err) => next(err));
    });
    return router;
}