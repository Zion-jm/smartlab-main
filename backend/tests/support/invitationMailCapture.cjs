require('../../scripts/test-environment.cjs').assertManagedTest();
const transport = require('../../dist/services/email/transporter');
transport.emailDeliveryConfigured = () => true;
transport.sendQueuedEmail = async () => {};
