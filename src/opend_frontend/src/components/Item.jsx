import React, { useEffect, useState } from "react";
import logo from "../../assets/logo.png";
import { Actor, HttpAgent } from "@dfinity/agent";
import { idlFactory } from "../../../declarations/nft/nft.did.js";
import { idlFactory as tokenIdlFactory } from "../../../declarations/token_backend/token_backend.did.js";
import { Principal } from "@dfinity/principal";
import Button from "./Button";
import { opend_backend } from "../../../declarations/opend_backend";
import CURRENT_USER_ID from "../index";
import PriceLabel from "./PriceLabel";

function Item(props) {
  const [name, setName] = useState();
  const [owner, setOwner] = useState("");
  const [image, setImage] = useState();
  const [button, setButton] = useState();
  const [priceInput, setPriceInput] = useState();
  const [loaderHidden, setLoaderHidden] = useState(true);
  const [blur, setBlur] = useState();
  const [sellStatus, setSellStatus] = useState("");
  const [priceLabel, setPriceLabel] = useState();
  const [shouldDisplay, setDisplay] = useState(true);

  const id = props.id;

  const localhost = "http://localhost:8080";
  const agent = new HttpAgent({ host: localhost });
  //WHEN DEPLOY LIVE REMOVE THIS!!
  agent.fetchRootKey();
  let NFTActor;

  async function loadNFT() {
    NFTActor = await Actor.createActor(idlFactory, {
      agent,
      canisterId: id,
    });

    const name2 = await NFTActor.getName();
    const ownerPrincipal = await NFTActor.getOwner();
    const imageData = await NFTActor.getAsset();
    const imageContent = new Uint8Array(imageData);
    const image = URL.createObjectURL(
      new Blob([imageContent.buffer], { type: "image/png" })
    );

    setName(name2);
    setOwner(ownerPrincipal.toText());
    setImage(image);

    if (props.role == "collection") {
      const nftIsListed = await opend_backend.isListed(props.id);

      if (nftIsListed) {
        setOwner("OpenD");
        setBlur({ filter: "blur(4px)" });
        setSellStatus("Listed");
      } else {
        setButton(<Button handleclick={handleSell} text={"Sell"} />);
      }
    } else if (props.role == "discover") {
      const originalOwner = await opend_backend.getOriginalOwner(props.id);
      if (originalOwner.toText() != CURRENT_USER_ID.toText()) {
        setButton(<Button handleclick={handleBuy} text={"Buy"} />);
      }

      const price = await opend_backend.getListedNFTPrice(props.id);
      setPriceLabel(<PriceLabel sellPrice={price.toString()} />);
    }
  }

  useEffect(() => {
    loadNFT();
  }, []);

  let price;

  function handleSell() {
    console.log("Sell clicked");
    setPriceInput(
      <input
        placeholder="Price in DANG"
        type="number"
        className="price-input"
        value={price}
        onChange={(e) => (price = e.target.value)}
      />
    );

    setButton(<Button handleclick={sellItem} text={"Confirm"} />);
  }

  async function sellItem() {
    setLoaderHidden(false);
    setBlur({ filter: "blur(4px)" });

    console.log("set price = " + price);
    const listingResult = await opend_backend.listItem(props.id, Number(price));
    console.log("listing: " + listingResult);

    if (listingResult == "Success") {
      const openDid = await opend_backend.getOpenDCanisterID();
      const transferResult = await NFTActor.transferOwnership(openDid, true);
      console.log("transfer: " + transferResult);
      if (transferResult == "Success") {
        setLoaderHidden(true);
        setButton();
        setPriceInput();
        setOwner("OpenD");
        setSellStatus("Listed");
      }
    }
  }

  async function handleBuy() {
    console.log("BUY TRIGGERED");
    setLoaderHidden(false);
    const tokenActor = await Actor.createActor(tokenIdlFactory, {
      agent,
      canisterId: Principal.fromText("be2us-64aaa-aaaaa-qaabq-cai"),
    });

    const sellerId = await opend_backend.getOriginalOwner(props.id);
    const itemPrice = await opend_backend.getListedNFTPrice(props.id);

    const result = await tokenActor.transfer(sellerId, itemPrice);
    console.log(result);

    if (result == "success") {
      //transfer the ownership
      const transferResult = await opend_backend.completePurchase(
        props.id,
        sellerId,
        CURRENT_USER_ID
      );
      console.log("PURCHASE: " + transferResult);
      setLoaderHidden(true);
      setDisplay(false);
    }
  }

  return (
    <div
      style={{ display: shouldDisplay ? "inline" : "none" }}
      className="disGrid-item"
    >
      <div className="disPaper-root disCard-root makeStyles-root-17 disPaper-elevation1 disPaper-rounded">
        <img
          className="disCardMedia-root makeStyles-image-19 disCardMedia-media disCardMedia-img"
          src={image}
          style={blur}
        />
        <div className="lds-ellipsis" hidden={loaderHidden}>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
        </div>
        <div className="disCardContent-root">
          {priceLabel}
          <h2 className="disTypography-root makeStyles-bodyText-24 disTypography-h5 disTypography-gutterBottom">
            {name}
            <span className="purple-text"> {sellStatus}</span>
          </h2>
          <p className="disTypography-root makeStyles-bodyText-24 disTypography-body2 disTypography-colorTextSecondary">
            Owner: {owner}
          </p>
          {priceInput}
          {button}
        </div>
      </div>
    </div>
  );
}

export default Item;