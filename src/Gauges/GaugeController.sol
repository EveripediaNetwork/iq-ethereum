// SPDX-License-Identifier: MIT

pragma solidity >=0.7.1;
pragma experimental ABIEncoderV2;

interface GaugeController {
    struct Point {
        uint256 bias;
        uint256 slope;
    }

    struct VotedSlope {
        uint256 slope;
        uint256 power;
        uint256 end;
    }

    // Public variables
    function admin() external view returns (address);

    function futureAdmin() external view returns (address);

    function token() external view returns (address);

    function votingEscrow() external view returns (address);

    function nGaugeTypes() external view returns (int128);

    function nGauges() external view returns (int128);

    function gaugeTypeNames(int128) external view returns (string memory);

    function gauges(int256) external view returns (address);

    function voteUserSlopes(address, address) external view returns (VotedSlope memory);

    function voteUserPower(address) external view returns (uint256);

    function lastUserVote(address, address) external view returns (uint256);

    function pointsWeight(address, uint256) external view returns (Point memory);

    function timeWeight(address) external view returns (uint256);

    function pointsSum(int128, uint256) external view returns (Point memory);

    function timeSum(uint256) external view returns (uint256);

    function pointsTotal(uint256) external view returns (uint256);

    function timeTotal() external view returns (uint256);

    function pointsTypeWeight(int128, uint256) external view returns (uint256);

    function timeTypeWeight(uint256) external view returns (uint256);

    // Getter functions
    function gaugeTypes(address) external view returns (int128);

    function gaugeRelativeWeight(address) external view returns (uint256);

    function gaugeRelativeWeight(address, uint256) external view returns (uint256);

    function getGaugeWeight(address) external view returns (uint256);

    function getTypeWeight(int128) external view returns (uint256);

    function getTotalWeight() external view returns (uint256);

    function getWeightsSumPerType(int128) external view returns (uint256);

    // External functions
    function commitTransferOwnership(address) external;

    function applyTransferOwnership() external;

    function add_gauge(
        address,
        int128,
        uint256
    ) external;

    function checkpoint() external;

    function checkpointGauge(address) external;

    function globalEmissionRate() external view returns (uint256);

    function gaugeRelativeWeightWrite(address) external returns (uint256);

    function gaugeRelativeWeightWrite(address, uint256) external returns (uint256);

    function addType(string memory, uint256) external;

    function changeTypeWeight(int128, uint256) external;

    function changeGaugeWeight(address, uint256) external;

    function changeGlobalEmissionRate(uint256) external;

    function voteForGaugeWeights(address, uint256) external;
}
