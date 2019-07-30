pragma solidity >=0.4.21 <0.6.0;

import "truffle/Assert.sol";
import "truffle/DeployedAddresses.sol";
import "../contracts/AptroToken.sol";

contract TestAptroToken {
    uint256 constant private DECIMAL_MULT = 1000000000000000000;

    function testInitialBalanceUsingDeployedContract() public {
        AptroToken coin = AptroToken(DeployedAddresses.AptroToken());

        uint expected = 10000*DECIMAL_MULT;

        Assert.equal(
            coin.balanceOf(msg.sender),
            expected,
            "Owner should have 10000 Coin initially"
        );
    }

    function testInitialBalanceWithNewCoin() public {
        AptroToken coin = new AptroToken();

        uint expected = 10000*DECIMAL_MULT;

        Assert.equal(
            coin.balanceOf(address(this)),
            expected,
            "Owner should have 10000 Coin initially"
        );
    }
}
