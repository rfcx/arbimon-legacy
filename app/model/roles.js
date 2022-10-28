const listOfRoles = {
  1: "Admin", // Admin
  2: "Member", // User
  3: "Guest", // Guest
  4: "Admin", // Project Owner
  5: "Member", // Data Entry
  6: "Member", // Expert
  7: "Guest" // Citizen Scientist
}

const Roles = {
  getCoreRoleById: function(roleId) {
    return listOfRoles[roleId]
  }
}

module.exports = Roles;
