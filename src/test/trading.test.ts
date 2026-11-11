import { describe, it, expect } from "vitest";
import { defaultRules, entryAmount, settleOrder, tradeBlock, type Order } from "@/lib/trading";
const order: Order = {id:"a",asset:"EUR/USD (OTC)",dir:"up",price:1.12,amt:12,openedAt:0,expiresAt:60000};
describe("demo orders",() => {
  it("keeps the order open until its chosen duration expires",() => {expect(settleOrder(order,1.13,59999).closedAt).toBeUndefined();expect(settleOrder(order,1.13,60000).closedAt).toBe(60000);});
  it("settles above orders and below orders with 86% payout",() => {expect(settleOrder(order,1.13,60000).result).toBe(10.32);expect(settleOrder({...order,dir:"down"},1.13,60000).result).toBe(-12);});
  it("returns a tied stake without profit",() => {expect(settleOrder(order,1.12,60000).result).toBe(0);});
  it("applies a 1.6 Martingale for one level",() => {const loss = settleOrder(order,1.11,60000);expect(entryAmount({...defaultRules,martingale:true},100,[loss])).toBe(19.2);expect(entryAmount({...defaultRules,martingale:true},100,[loss,{...loss,id:"b",closedAt:70000}])).toBe(12);});
  it("blocks simultaneous orders when disabled",() => {expect(tradeBlock({...defaultRules,simultaneous:false},[order],12,100,100)).toBe("Aguarde a ordem aberta encerrar.");});
  it("blocks the configured stop loss",() => {expect(tradeBlock({...defaultRules,stopLoss:12},[settleOrder(order,1.11,60000)],12,100,100)).toBe("Stop LOSS atingido.");});
  it("blocks the configured stop win",() => {expect(tradeBlock({...defaultRules,stopWin:10},[settleOrder(order,1.13,60000)],12,100,100)).toBe("Stop WIN atingido.");});
});