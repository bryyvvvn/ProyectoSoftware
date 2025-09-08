import React from 'react';

interface DashboardPops {
    data: any;
}

const Dashboard: React.FC<DashboardPops> = ({ data }) => {
    return(
        <div style={{padding: '2rem', fontFamily: 'sans-serif'}}>
            <h1>Datos obtenidos</h1>
            <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
    );
};

export default Dashboard;