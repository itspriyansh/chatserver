var mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    from: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    message: {
        type: String,
        required: true
    },
    keys: {
        type: Map,
        of: String
    },
    queue: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }]
},{
    timestamps: true
});

const Chat = new mongoose.Schema({
    name: {
        type: String,
        default: null
    },
    personal: {
        type: Boolean,
        default: true
    },
    members: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }],
    messages: [messageSchema]
},{
    timestamps: true
});
module.exports = mongoose.model('Chat', Chat);