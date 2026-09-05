/* Copyright (c) 2026 Eastern Cross Technology. All rights reserved. */
sealed class ShiftAuditDocument
{
 public string ShiftNumber {get;set;}="";
 public DateTimeOffset OpenedAt {get;set;}
 public DateTimeOffset ClosedAt {get;set;}
 public string Note {get;set;}="Captured at shift close. Times: Pakistan Standard Time (UTC+05:00).";
 public List<ShiftAuditOrder> Orders {get;set;}=[];
 public List<ShiftAuditEvent> Events {get;set;}=[];
}
sealed class ShiftAuditOrder
{
 public long Id {get;set;}
 public int Token {get;set;}
 public string Mode {get;set;}="";
 public string Status {get;set;}="";
 public string PaymentStatus {get;set;}="";
 public decimal Total {get;set;}
 public string Items {get;set;}="";
 public string Customer {get;set;}="";
}
sealed class ShiftAuditEvent
{
 public int Token {get;set;}
 public DateTimeOffset At {get;set;}
 public string Action {get;set;}="";
 public string Actor {get;set;}="";
 public string Role {get;set;}="";
 public string Details {get;set;}="";
}
