const listOfRoles = {
  1: "Admin",
  2: "Member",
  3: "Guest"
}

const Roles = {
  getRoleById: function(roleId) {
    return listOfRoles[roleId]
  }
}

module.exports = Roles;