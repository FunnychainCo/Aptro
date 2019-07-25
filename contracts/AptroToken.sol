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
    uint constant private MAX_TOKEN = 100000000;
    uint constant private MAX_MINT_TIME = 10 * 365 days; //10 years
    uint constant private MAX_MINT_RATE = MAX_TOKEN / MAX_MINT_TIME; //token mintable by time unit
    uint private birthDate = 0;//birth date of this smart contract
    mapping(uint256 => bool) private usedNonces;//security nounces
    mapping (address => uint256) private _delegated;

    constructor () public ERC20Detailed("Aptro Token", "APTRO", 18) ERC20Capped(MAX_TOKEN) {
        // solhint-disable-previous-line no-empty-blocks
        birthDate = block.timestamp;
    }

    /**
    * @dev See {ERC20-_mint}.
    * Mint token according to MAX_MINT_RATE.
    **/
    function mint(address account, uint256 amount) public onlyMinter returns (bool) {
        require( (totalSupply() > (block.timestamp.sub(birthDate)).mul(MAX_MINT_RATE)) || (totalSupply()<100000), "AptroToken: mint rate exceded");
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
    function undelegateAndTransfertTo(address recipient, uint256 amount) public{
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
    function undelegateAndTransfertFrom(address sender, bytes memory senderSignature, uint256 nonce, uint256 amount) public
     returns (bytes memory numberToHash, bytes32 hash, bytes memory amountAsBytes){
        address recipient = msg.sender;
        require(!usedNonces[nonce],"AptroToken: invalid nonce");
        usedNonces[nonce] = true;
        require(sender != address(0), "AptroToken: transfer from the zero address");
        require(recipient != address(0), "AptroToken: transfer to the zero address");

        //prepare the data to hash
        numberToHash = _toBytesUint256(nonce);////TODO bytes memory
        amountAsBytes = _toBytesUint256(amount);////TODO bytes memory
        //diversify the nounce with the amount
        for (uint i=0; i<32; i++) {
            numberToHash[i] = numberToHash[i]|amountAsBytes[i];
        }
        //hash the data
        hash = keccak256(numberToHash);////TODO bytes32
        //verify the validity of the data
        address singSenderAddress = ECDSA.recover(ECDSA.toEthSignedMessageHash(hash),senderSignature);
        require(singSenderAddress == sender, "AptroToken: invalid signature");
        //perform operation
        _delegated[sender] = _delegated[sender].sub(amount);
        _transfer(address(this), recipient, amount);
    }


    function _toBytesUint256(uint256 x) internal pure returns (bytes memory b) {
        b = new bytes(32);
        assembly { mstore(add(b, 32), x) }
    }

}