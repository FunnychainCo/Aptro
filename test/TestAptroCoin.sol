pragma solidity >=0.4.21 <0.6.0;

import "truffle/Assert.sol";
import "truffle/DeployedAddresses.sol";
import "../contracts/AptroToken.sol";

contract TestAptroToken {
    function testInitialBalanceUsingDeployedContract() public {
        AptroToken coin = AptroToken(DeployedAddresses.AptroToken());

        uint expected = 0;

        Assert.equal(
            coin.balanceOf(msg.sender),
            expected,
            "Owner should have 0 Coin initially"
        );
    }

    function testInitialBalanceWithNewCoin() public {
        AptroToken coin = new AptroToken();

        uint expected = 0;

        Assert.equal(
            coin.balanceOf(address(this)),
            expected,
            "Owner should have 0 Coin initially"
        );
    }
}
