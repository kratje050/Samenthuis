import { accountDisplayName, personalizedGreeting } from '../js/utils/account.js';
import { equal } from './test-utils.js';

export const accountTests = [
  ['begroeting gebruikt geen naam zonder ingelogd account', () => {
    equal(accountDisplayName({ signedIn: false, user: { user_metadata: { display_name: 'Roy' } } }), '');
    equal(personalizedGreeting('Goedenavond', ''), 'Goedenavond.');
  }],
  ['begroeting gebruikt de naam van het ingelogde account', () => {
    const name = accountDisplayName({ signedIn: true, user: { id: 'user-1', user_metadata: { display_name: 'Demy' } } });
    equal(name, 'Demy');
    equal(personalizedGreeting('Goedemorgen', name), 'Goedemorgen, Demy.');
  }],
  ['gezinsnaam van de huidige gebruiker heeft voorrang', () => {
    equal(accountDisplayName({
      signedIn: true,
      user: { id: 'user-1', user_metadata: { display_name: 'Accountnaam' } },
      family: { display_name: 'Miley' },
      familyMembers: [{ user_id: 'user-1', display_name: 'Miley' }]
    }), 'Miley');
  }],
  ['begroeting gebruikt alleen het overeenkomende gezinslid', () => {
    equal(accountDisplayName({
      signedIn: true,
      user: { id: 'user-2' },
      familyMembers: [{ user_id: 'user-1', display_name: 'Roy' }, { user_id: 'user-2', display_name: 'Navy' }]
    }), 'Navy');
  }]
];
