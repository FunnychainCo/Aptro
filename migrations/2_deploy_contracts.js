const AptroToken = artifacts.require("AptroToken");

module.exports = function(deployer) {
  deployer.deploy(AptroToken);
};
