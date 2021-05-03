const listOfRoles = {
  1: "Member",
  2: "Member",
  3: "Guest",
  4: "Admin",
  5: "Member",
  6: "Member",
  7: "Guest"
}

const Roles = {
  getCoreRoleById: function(roleId) {
    return listOfRoles[roleId]
  }
}

module.exports = Roles;