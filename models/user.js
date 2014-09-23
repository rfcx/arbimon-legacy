module.exports = function(sequelize, DataTypes) {
  var User = sequelize.define('User', {
    login      : DataTypes.STRING,
    password   : DataTypes.STRING,
    firstname  : DataTypes.STRING,
    lastname   : DataTypes.STRING,
    email      : DataTypes.STRING,
    last_login : DataTypes.DATE    
  }, {
    classMethods: {
      associate: function(models) {
        User.hasMany(models.Task)
      }
    }
  })
 
  return User
};