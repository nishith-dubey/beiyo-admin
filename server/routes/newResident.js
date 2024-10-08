// Backend (Node.js/Express)
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();
const moment = require('moment')

const Resident = require('../models/newMemberResident'); // Your Resident model
const dayjs = require('dayjs');
const Payment = require('../models/Payment');
const Hostels = require('../models/Hostel');
const Rooms = require('../models/Room');
const totalTenants = require('../functions/TotalTenats');
const uuid = require('uuid');
const uploadFile = require('../firebase/firebase');
const Hostel = require('../models/Hostel');
const totalRemainingBeds = require('../functions/totalRemainingBeds');
const mappingResident = require('../functions/MappingResident');


router.post('/websiteBooking',async(req,res)=>{
  try {
    const {name, email, mobileNumber,hostelId,roomNumberId,dateJoined,rent,deposit,depositStatus,firstMonthRentStatus,maintainaceCharge,maintainaceChargeStatus,formFee,formFeeStatus,contractTerm,extraDayPaymentAmount,extraDayPaymentAmountStatus,extraDays,gender} = req.body;
    const formattedDate = dateJoined ? dayjs(dateJoined).format('YYYY-MM-DD') : null;
    const contractEndDate = moment(formattedDate).add(contractTerm, 'months').format('YYYY-MM-DD');
    const Hostel = await Hostels.findById(hostelId);
    const Room = await Rooms.findById(roomNumberId);
    const hostelName = Hostel.name;
    const roomNumber  = Room.roomNumber;
    let dueAmount = 0;
    let livingStatus = "current";
    if(!depositStatus){
      dueAmount += deposit;
    }
    if(!maintainaceChargeStatus){
      dueAmount += maintainaceCharge;
    }
    if(!formFeeStatus){
      dueAmount += formFee;
    }
    if(!extraDayPaymentAmountStatus){
      dueAmount += extraDayPaymentAmount;
    }
    if(!depositStatus&&!firstMonthRentStatus&&!extraDayPaymentAmountStatus&&!maintainaceChargeStatus){
       livingStatus = "new"
    }

    
    const newResident = new Resident({
      name, email, mobileNumber, 
       hostelId,   
      roomNumberId:roomNumberId,
      hostel: hostelName,
      roomNumber: roomNumber,
      dateJoined: formattedDate,
      contractEndDate,
      contractTerm,
      rent:rent,
      deposit:deposit,
      maintainaceCharge:maintainaceCharge,
      formFee:formFee,
      dueAmount:dueAmount,
      extraDayPaymentAmount:extraDayPaymentAmount,
      extraDayPaymentAmountStatus:extraDayPaymentAmountStatus,
      depositStatus:depositStatus,
      maintainaceChargeStatus:maintainaceChargeStatus,
      formFeeStatus:formFeeStatus,
      extraDays,
      gender,
      living:livingStatus
    });
    await newResident.save();
        const resident = await Resident.findOne({ email });
    
              
      if(Room.remainingCapacity>0){
        Room.remainingCapacity--;

        Room.residents.push(resident._id);
        await Room.save();
      }else{
        return res.status(400).json({message:"Room is full"});
      }
      if(Hostel.totalRemainingBeds>0){
        Hostel.totalRemainingBeds--;
        Hostel.residents.push(resident._id);
        await Hostel.save();
      }else{
        return res.status(400).json({message:"Hostel Room is full"});
      }

      await totalTenants(hostelId);
      await totalRemainingBeds(hostelId);
      if(depositStatus||firstMonthRentStatus){
      await generateMonthlyPayments(resident._id, resident.contractEndDate);
      await generateDueCharge(resident._id);
      if(firstMonthRentStatus){
        const user = await Resident.findById(resident._id);
        const firstMonthRent = await Payment.findByIdAndUpdate(user.payments[0],{
          "status":"successful"
        },{new:true});
      }
    }
        res.status(201).json(newResident);
  } catch (error) {
    res.json({"message":error.message})
  }
})


 router.post('/',async(req,res)=>{
    try {
        const { name, email, mobileNumber, address, parentsName, parentsMobileNo, hostelId, roomNumberId , dateJoined, password, rent,deposit,contractTerm,aadhaarCardUrl,imageUrl,maintainaceCharge,formFee,dueAmount} = req.body;
        const formattedDate = dateJoined ? dayjs(dateJoined).format('YYYY-MM-DD') : null;
        const contractEndDate = moment(formattedDate).add(contractTerm, 'months').format('YYYY-MM-DD');
      
        
        const Hostel = await Hostels.findById(hostelId);
        const Room = await Rooms.findById(roomNumberId);
        const hostelName = Hostel.name;
        const roomNumber  = Room.roomNumber;
        

        // Upload Aadhaar Card
        // if (!req.files || !req.files.aadhaarCard || !req.files.image) {
        //   return res.status(400).json({ message: "Missing Aadhaar card or photo file" });
        // }
        // const firebaseUserId = uuid.v4();
        // const [aadhaarCardUrl, imageUrl] = await Promise.all([
        //   uploadFile(req.files.aadhaarCard, `residentAadhaarCards/${firebaseUserId}_aadhaar.jpg`),
        //   uploadFile(req.files.image, `residentImages/${firebaseUserId}_image.jpg`),
        // ]);
        
        const newResident = new Resident({
          name, email, mobileNumber, address, parentsName,
          parentsMobileNo, hostelId,  password, 
          roomNumberId:roomNumberId,
          hostel: hostelName,
          roomNumber: roomNumber,
          dateJoined: formattedDate,
          contractEndDate,
          contractTerm,
          rent:rent,
          deposit:deposit,
          aadhaarCardUrl:aadhaarCardUrl,
          imageUrl:imageUrl,
          maintainaceCharge:maintainaceCharge,
          formFee:formFee,
          dueAmount:dueAmount
        });
        await newResident.save();
        const resident = await Resident.findOne({ email });

        if(Room.remainingCapacity>0){
          Room.remainingCapacity--;

          Room.residents.push(resident._id);
          await Room.save();
        }else{
          return res.status(400).json({message:"Room is full"});
        }
        if(Hostel.totalRemainingBeds>0){
          Hostel.totalRemainingBeds--;
          Hostel.residents.push(resident._id);
          await Hostel.save();
        }else{
          return res.status(400).json({message:"Hostel Room is full"});
        }

        await totalTenants(hostelId);
        await totalRemainingBeds(hostelId);
        await generateMonthlyPayments(resident._id, resident.contractEndDate);
        await generateDueCharge(resident._id);
    
        res.status(201).json(newResident);
    } catch (error) {
      
        console.error('Error creating resident', error);
        res.status(500).send('Error creating resident or processing payment:', error);
    }  
 });

 router.get('/', async (req, res) => {
    try {
      const newResidents = await Resident.find();
      // updateResidentHostelIds();
      // amountToRent();
      // mappingResident();
      res.json(newResidents);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });


// geting  all residents through ids
router.get('/allResidentIds', async (req, res) => {
  try {
    // Get the list of resident IDs from the query parameter (assuming they are comma-separated)
    const residentIds = req.query.ids.split(',');

    // Find residents in the database whose IDs match the provided list
    const residents = await Resident.find({
      _id: { $in: residentIds }
    });

    // Return the list of residents
    res.status(200).json(residents);
  } catch (error) {
    console.error('Error fetching residents:', error);
    res.status(500).json({ error: 'Failed to fetch residents' });
  }
});





  // delting resident
  router.delete('/deleteResident/:id',async(req,res)=>{
    try { 
      const residentId = req.params.id;
      const resident = await Resident.findById(residentId);
      if (!resident) {
        return res.status(404).json({ message: "Resident not found" });
        }
        if(resident.living==='old'){
          return res.status(200).json({ message: "Resident already left the beiyo" });
        }
        await Rooms.updateOne({ _id: resident.roomNumberId }, { $pull: { residents:
          resident._id },$inc: { remainingCapacity: 1 } });
        await Hostel.updateOne({_id:resident.hostelId},{
          $pull:{residents:resident._id}
        })  

        await totalTenants(resident.hostelId);
        await totalRemainingBeds(resident.hostelId);
        resident.living='old'
        await resident.save();
        res.status(200).json('Resident Left the Beiyo')
    } catch (error) {
      res.json(error)
      console.log(error);
    }
  })

// update Put resident
// PUT API to update resident data
router.put('/:id', async (req, res) => {
  try {
    const residentId = req.params.id;
    
    // Extract the data to update from the request body
    const updateData = req.body;

    const resident = await Resident.findById(residentId);
    if (!resident) {
      return res.status(404).json({ message: 'Resident not found' });
    }

    if (updateData.rent && updateData.rent !== resident.rent) {
      const newAmount = updateData.rent;

      // Update the resident's payments array
      await Payment.updateMany(
        { userId: residentId },
        { $set: { amount: newAmount ,rent:newAmount} },
        { new: true }
      );
    }

    // Find the resident by ID and update it with the provided data
    const updatedResident = await Resident.findByIdAndUpdate(
      residentId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedResident) {
      return res.status(404).json({ message: 'Resident not found' });
    }

    res.status(200).json({
      message: 'Resident updated successfully',
      data: updatedResident,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating resident', error: error.message });
  }
});


  router.get('/hostel/:id',async(req,res)=>{
    try {
      const newResidents = await Resident.find({hostelId:req.params.id});
      res.json(newResidents);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  })
  router.get('/:id', async (req, res) => {
    try {
      const residentId = req.params.id
      const resident = await Resident.findById(residentId);
      if (!resident) {
        return res.status(404).json({ message: 'Resident not found' });
      }
      
      // console.log(`Generating payments for resident: ${resident._id}, contract end date: ${resident.contract}`);
      
      res.json(resident);
    } catch (error) {
      console.error('Error fetching resident or generating payments:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });
  
router.post('/amount',async(req,res)=>{
  try {
    const email = req.body.email;
    const amount = req.body.amount;
    const contract = req.body.contract
    const resident = await Resident.findOneAndUpdate( 
       {  email },
      {  amount,contract: new Date() },
      { new: true }
    );
    if (!resident) {
      return res.status(404).json({ message: 'Resident not found' });
    }
    resident.amount = amount;
    resident.contract=contract;
    await resident.save();

  } catch (error) {
    console.log(error);
  }
})

router.get('/resident/contractEnd', async (req, res) => {
  try {
    // Get the current month in the format 'YYYY-MM'
    const currentMonth = moment().format('YYYY-MM');
  
    // Find residents who are currently living and populate their payments
    const residents = await Resident.find({ "living": "current" }).populate('payments');
  
    // Filter residents whose last payment's month is before the current month
    const contractEndedResidents = residents.filter(resident => {
      const lastPayment = resident.payments[resident.payments.length - 1];
      
      // Ensure there is a last payment and the payment month is stored in 'YYYY-MM' format
      if (lastPayment && lastPayment.month) {
        // Compare the saved payment month with the current month
        return moment(lastPayment.month, 'YYYY-MM').isBefore(currentMonth, 'month');
      }
  
      return false; // Exclude residents with no payments or payments within the current or future months
    });
  
    // Respond with the filtered list of residents
    res.status(200).json(contractEndedResidents);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Server error' });
  } 
});

router.put('/extendContract/:residentId',async(req,res)=>{
  try {
    const extendedMonth = req.body.extendedMonth;
    const formattedDate = moment().format('YYYY-MM-DD');
    const contractEndDate = moment(formattedDate).add(extendedMonth, 'months').format('YYYY-MM-DD');
    const oldResident = await Resident.findById(req.params.residentId);


    const resident = await Resident.findByIdAndUpdate(req.params.residentId, { 
      contractEndDate,
    }, { new: true})
    if (!resident) {
      return res.status(404).json({ message: 'Resident not found' });
    }
    await generateMonthlyPayments(resident._id, contractEndDate);
    res.status(200).json(resident);
  } catch (error) {
    console.log(error);
  }
})

  

    // Payment successful, save user data
    module.exports = router;

    const generateMonthlyPayments = async (userId, contractEndDate) => {
     try {
      const resident = await Resident.findById(userId);
      const startDate = dayjs(resident.dateJoined).startOf('month');
      const endDate = dayjs(contractEndDate).endOf('month');
      let currentDate = startDate;
      
      while (currentDate.isBefore(endDate)) {
        const month = currentDate.format('YYYY-MM');
        const existingPayment = await Payment.findOne({ userId, month });
    
        if (!existingPayment) {
          // rishabh jain mayank hasardani ritk lodhi amount is wrong
          const payment = new Payment({
            userId,
            userName:resident.name,
            rent: resident.rent,
            amount: resident.rent, // Replace with the appropriate amount
            month,
            date: currentDate.toDate(),
            status: 'due',
            type:'rent'
          });
    
          await payment.save();
          resident.payments.push(payment._id);
         
        }
    
        currentDate = currentDate.add(1, 'month');
        await resident.save();
        const newResident = await Resident.findByIdAndUpdate(userId,{
          contractTerm:resident.payments.length
        },{
          new:true
        })
        
      }

     } catch (error) {
      console.log(error);
     }
    };
    
   const generateDueCharge = async(userId)=>{
    try {
      const resident = await Resident.findById(userId);
      const startDate = dayjs(resident.dateJoined).startOf('month');
        const month = startDate.format('YYYY-MM');
        const existingPayment = await Payment.findOne({ userId, month ,type:'dueCharge'});
        if(!existingPayment){
          const payment = new Payment({
            userId,
            userName:resident.name,
            amount: resident.dueAmount, // Replace with the appropriate amount
            month,
            date: startDate.toDate(),
            status: 'due',
            type:'dueCharge'
          });
    
          await payment.save();
          resident.dueChargePayment=payment._id;
          await resident.save();
        }
    } catch (error) {
      console.log(error);
    }
   }

    async function updateResidentHostelIds() {
      try {
        // Fetch all residents
        const residents = await Resident.find();
    
        // Iterate over each resident
        for (const resident of residents) {
          // Find hostel ID by hostel name
          const hostel = await Hostel.findOne({ name: resident.hostel });
          
          if (hostel) {
            // Update resident with the found hostel ID
            await Resident.updateOne(
              { _id: resident._id },
              { $set: { hostelId: hostel._id } }
            );
            console.log(`Updated resident ${resident.name} with hostel ID ${hostel._id}`);
          } else {
            console.log(`Hostel not found for resident ${resident.name}`);
          }
        }
      } catch (error) {
        console.error('Error updating resident hostel IDs:', error);
      }
    }
    