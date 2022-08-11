const Util = require('util');
// const Wmic = require('wmic')
const Qrcode = require('qrcode')
// const Os = require('os')
// const NodeWmi = require('node-wmi')
const CopyWmi = require('./queryWmi')

// const WmicGetList = Util.promisify(Wmic.get_list);
// const WmiQuery = Util.promisify(NodeWmi.Query);
const CopyWmiQuery = Util.promisify(CopyWmi.Query);
const WmiQuery = CopyWmiQuery;

let outputObj = {};
let outputHtml = "";

function dealDate(date){
  let result = ""
  if(typeof date == "string") {
    let temp = date.slice(0,8).split("")
    temp.splice(4,0,'/')
    temp.splice(7,0,'/')
    result = temp.join("")
  }else {
    let temp = new Date(date)
    result = `${temp.getFullYear()}/${('0'+(temp.getMonth()+1)).slice(-2)}/${('0'+temp.getDate()).slice(-2)}`
  }
  return result;
}


async function getByWmin() {

  // const computersystem = await WmicGetList("computersystem");
  // const csproduct = await WmicGetList("csproduct");
  const Win32_ComputerSystem = await WmiQuery({class:"Win32_ComputerSystem"});
  const Win32_ComputerSystemProduct = await WmiQuery({class:"Win32_ComputerSystemProduct"});

  outputObj["基础信息"] = {
    "机名": Win32_ComputerSystem[0]["Name"],
    "型号": Win32_ComputerSystem[0]["Model"],
    "系统": Win32_ComputerSystem[0]["SystemType"],
    "UUID": Win32_ComputerSystemProduct[0]["UUID"],
    "制造商": Win32_ComputerSystem[0]["Manufacturer"],
  };

  // const cpu = await WmicGetList("cpu");
  const Win32_CPU = await WmiQuery({class:"Win32_Processor"});
  outputObj["处理器"] = {
    "名称": Win32_CPU[0]["Name"],
    "核心数": `${Win32_CPU[0]["NumberOfCores"]}核`,
    "制造商": Win32_CPU[0]["Manufacturer"],
  };


  // const baseboard = await WmicGetList("baseboard");
  const Win32_BaseBoard = await WmiQuery({class:"Win32_BaseBoard"});
  const Win32_Bios = await WmiQuery({class:"Win32_Bios"});
  outputObj["主板"] = {
    "名称": Win32_BaseBoard[0]["Product"],
    "序列号": Win32_BaseBoard[0]["SerialNumber"],
    "版本": Win32_BaseBoard[0]["Version"],
    "制造商": Win32_BaseBoard[0]["Manufacturer"],
    "BIOS序列号": Win32_Bios[0]["SerialNumber"],
    "BIOS版本": `${Win32_Bios[0]["Version"]} ${Win32_Bios[0]["Caption"]}`,
    "BIOS发布日期": `${dealDate(Win32_Bios[0]["ReleaseDate"])}`,
    "BIOS制造商": Win32_Bios[0]["Manufacturer"],
  };

  // const memorychip = await WmicGetList("memorychip");
  const Win32_PhysicalMemory = await CopyWmiQuery({class:"Win32_PhysicalMemory"});
  const physicalMemoryAray = Win32_PhysicalMemory.map(item => {
    return {
      "容量": `${Math.ceil(item["Capacity"] / 1024 / 1024 / 1024)}G`,
      "序列号": item["SerialNumber"],
      "标准频率": `${item["ConfiguredClockSpeed"]} MHZ`,
      "电压": `${Math.ceil(item["ConfiguredVoltage"] / 1000)} V`,
      "总线位宽": `${item["DataWidth"]} Bits`,
      "制造商": item["Manufacturer"],
    }
  })
  outputObj["内存"] = physicalMemoryAray;

  const Win32_DiskDrive = await WmiQuery({class:"Win32_DiskDrive"});
  const diskDriveArray = Win32_DiskDrive.map(item => {
    return {
      "型号": item["Model"],
      "容量": `${Math.ceil(item["Size"] / 1024 / 1024 / 1024)}G`,
      "类型": item["MediaType"],
      "序列号": item["SerialNumber"],
    }
  })
  outputObj["硬盘"] = diskDriveArray;

  const VideoController = await WmiQuery({class:"Win32_VideoController"});
  outputObj["显卡"] = {
    "名称": `${VideoController[0]["Caption"]}`,
    "类型": `${VideoController[0]["AdapterDACType"]}`,
    "显存": `${Math.ceil(VideoController[0]["AdapterRAM"] / 1024 / 1024 / 1024)}G`,
    "厂商": `${VideoController[0]["AdapterCompatibility"]}`,
    "驱动版本": `${VideoController[0]["DriverVersion"]}`,
    "驱动日期": `${dealDate(VideoController[0]["DriverDate"])}`,
  };

    // const sounddev = await WmicGetList("sounddev");
  const Win32_SoundDevice = await WmiQuery({class:"Win32_SoundDevice"});
  outputObj["声卡"] = Win32_SoundDevice.map(item => {
    return {"设备名称":item.Name};
  });

  // const nic = await WmicGetList("nic");
  const Win32_NetworkAdapter = await WmiQuery({class:"Win32_NetworkAdapter"});
  outputObj["网卡"] = Win32_NetworkAdapter.map(item => {
    return {"设备名称":item.Name};
  });

}

function initHtml() {

  for (const outPutkey in outputObj) {
    let contentHtml = "";
    if (typeof outputObj[outPutkey] != "object") {
      contentHtml = outputObj[outPutkey]
    } if (Array.isArray(outputObj[outPutkey])) {

      for (const index in outputObj[outPutkey]) {
        let itemWrapHtml = ""
        for (const itemKey in outputObj[outPutkey][index]) {
          itemWrapHtml += `<div class="item">${itemKey}: ${outputObj[outPutkey][index][itemKey]}</div>`
        }
        contentHtml += `<div class="itemWrap">${itemWrapHtml}</div>`
      }
      
    }else {
      for (const itemKey in outputObj[outPutkey]) {
        contentHtml += `<div class="item">${itemKey}: ${outputObj[outPutkey][itemKey]}</div>`
      }
    }

    outputHtml += `<div class="ouput"><div class="title">${outPutkey}</div><div class="content">${contentHtml}</div></div>`
  }


  document.getElementById("outputWrap").innerHTML = outputHtml

  Qrcode.toDataURL(JSON.stringify(outputObj), (err, data) => {
    document.getElementById("qrcodeWrap").innerHTML = '<img width="100%" height="100%" src="' + data + '">';
  })
}


window.addEventListener('DOMContentLoaded', async () => {
  await getByWmin();
  initHtml();
})




