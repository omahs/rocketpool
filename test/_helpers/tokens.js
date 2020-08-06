import { RocketETHToken, RocketNodeETHToken } from '../_utils/artifacts';


// Get the rETH balance of an address
export async function getRethBalance(address) {
    const rocketETHToken = await RocketETHToken.deployed();
    let balance = rocketETHToken.balanceOf.call(address);
    return balance;
}


// Get the current rETH collateral rate
export async function getRethCollateralRate() {
    const rocketETHToken = await RocketETHToken.deployed();
    let collateralRate = await rocketETHToken.getCollateralRate.call();
    return collateralRate;
}


// Get the current rETH token actual total supply
export async function getRethActualSupply() {
    const rocketETHToken = await RocketETHToken.deployed();
    let actualSupply = await rocketETHToken.actualTotalSupply.call();
    return actualSupply;
}


// Get the nETH balance of an address
export async function getNethBalance(address) {
    const rocketNodeETHToken = await RocketNodeETHToken.deployed();
    let balance = rocketNodeETHToken.balanceOf.call(address);
    return balance;
}

