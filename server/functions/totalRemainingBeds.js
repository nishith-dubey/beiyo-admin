const Hostel = require('../models/Hostel');
const Room = require('../models/Room');
// const Bed = require('../models/Beds')
const totalRemainingBeds = async (hostelId) => {
   
    
    
    
     
        
        // let total = 0;
        // const rooms = await Room.find({ hostelId: hostelId });

      
        // for (const room of rooms) {
        //         total+=room.remainingCapacity
        // }
        const hostel = await Hostel.findById(hostelId)
        await Hostel.findByIdAndUpdate(
            hostelId,
            { totalRemainingBeds:  hostel.totalBeds - hostel.totalTenants},
            { new: true } // Returns the updated document
        );
    

    return;
};


module.exports = totalRemainingBeds;