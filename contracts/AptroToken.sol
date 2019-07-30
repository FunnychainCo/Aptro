pragma solidity ^0.5.0;

import 'openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol';
import 'openzeppelin-solidity/contracts/token/ERC20/ERC20Capped.sol';
import 'openzeppelin-solidity/contracts/ownership/Ownable.sol';
import { ECDSA  } from "openzeppelin-solidity/contracts/cryptography/ECDSA.sol";

// ----------------------------------------------------------------------------
// Aptro token contract
// The owner of this token is responsible for the creation and distribution of this token. The token creation is capped by time for security.
// The token has a delegated state an can switch between the "delegated" and "regular" states. delegated token cannot be transferred.
// ----------------------------------------------------------------------------
contract AptroToken is ERC20Capped , ERC20Detailed,Ownable {

    uint8 constant private DECIMAL = 18;
    uint256 constant private DECIMAL_MULT = 1000000000000000000;
    uint256 constant private MAX_TOKEN = 100000000*DECIMAL_MULT;
    uint256 constant private MAX_MINT_TIME = 10 * 365 days; //10 years
    uint256 constant private MAX_MINT_RATE = MAX_TOKEN / MAX_MINT_TIME; //token mintable by time unit
    uint256 constant private MINT_RATE_ACTIVATION_VALUE = 100000*DECIMAL_MULT;

    uint private birthDate = 0;//birth date of this smart contract
    mapping(uint256 => bool) private usedNonces;//security nounces
    mapping (address => uint256) private _delegated;

    constructor () public ERC20Detailed("Aptro Token", "APTRO", DECIMAL) ERC20Capped(MAX_TOKEN) {
        // solhint-disable-previous-line no-empty-blocks
        birthDate = block.timestamp;
        mint(msg.sender,20000*DECIMAL_MULT);//initial mint
        delegate(msg.sender,10000*DECIMAL_MULT);//initial delegate
    }

    /**
    * @dev See {ERC20-_mint}.
    * Mint token according to MAX_MINT_RATE.
    **/
    function mint(address account, uint256 amount) public onlyMinter returns (bool) {
        require( (totalSupply() > (block.timestamp.sub(birthDate)).mul(MAX_MINT_RATE)) || (totalSupply()<MINT_RATE_ACTIVATION_VALUE), "AptroToken: mint rate exceded");
        _mint(account, amount);
        return true;
    }

    /**
    * Delegate an amount of token to a manager address
    **/
    function delegate(address recipient, uint256 amount) public {
        address sender = msg.sender;
        require(sender != address(0), "ERC20: transfer from the zero address");
        require(recipient != address(0), "ERC20: transfer to the zero address");

        _transfer(sender,address(this),amount);
        _delegated[recipient] = _delegated[recipient].add(amount);
    }

    /**
    * Delegated fund balance of an address
    **/
    function delegatedBalanceOf(address account) public view returns (uint256) {
        return _delegated[account];
    }

    /**
    * Undelegate an amount of token and transfer it to a recipient
    * fee paid by the delegator
    **/
    function undelegateAndTransferTo(address recipient, uint256 amount) public{
        address sender = msg.sender;
        require(sender != address(0), "AptroToken: transfer from the zero address");
        require(recipient != address(0), "AptroToken: transfer to the zero address");

        _delegated[sender] = _delegated[sender].sub(amount);
        _transfer(address(this),recipient,amount);
    }

    /**
    * Undelegate an amount of token and transfert it to a recipient
    * fee paid by the receiver
    **/
    function undelegateAndTransferFrom(address sender, bytes memory senderSignature, uint256 nonce, uint256 amount) public{
        address recipient = msg.sender;
        require(recipient!=sender,"AptroToken: invalid sender or recipient");
        require(senderSignature.length == 65,"AptroToken: invalid signature (bad length)");
        require(amount!=0,"AptroToken: invalid amount");
        require(!usedNonces[nonce],"AptroToken: invalid nonce");
        require(sender != address(0), "AptroToken: transfer from the zero address");
        require(recipient != address(0), "AptroToken: transfer to the zero address");

        //prepare the data to hash
        bytes memory numberToHash = _toBytesUint256(nonce);
        bytes memory amountAsBytes = _toBytesUint256(amount);

        //diversify the nounce with the amount
        for (uint i=0; i<32; i++) {
            numberToHash[i] = numberToHash[i]|amountAsBytes[i];
        }

        //hash the data
        bytes32 hash = keccak256(numberToHash);

        //verify the validity of the data
        address singSenderAddress = ECDSA.recover(ECDSA.toEthSignedMessageHash(hash),senderSignature);
        require(singSenderAddress == sender, "AptroToken: invalid signature");

        //perform operation
        usedNonces[nonce] = true;
        _delegated[sender] = _delegated[sender].sub(amount);
        _transfer(address(this), recipient, amount);
    }


    function _toBytesUint256(uint256 x) internal pure returns (bytes memory b) {
        b = new bytes(32);
        assembly { mstore(add(b, 32), x) }
    }

}