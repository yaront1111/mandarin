const User = require("./User")
const Message = require("./Message")
const Story = require("./Story")
const PhotoPermission = require("./PhotoPermission")
const Like = require("./Like")

module.exports = {
  User: require("./User"),
  Message: require("./Message"),
  PhotoPermission: require("./PhotoPermission"),
  Like: require("./Like"),
  Story,
}
