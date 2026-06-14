/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/naura.json`.
 */
export type Naura = {
  "address": "6WngBHVPBX2y27UxP6epeY1LkkYR7afM4MiYoCCa13MF",
  "metadata": {
    "name": "naura",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Naura — afforestation funding escrow protocol (native SOL escrow + controlled milestone release)"
  },
  "instructions": [
    {
      "name": "cancelProject",
      "docs": [
        "Cancel a project (funder or admin only): Active -> Cancelled, entering refund-only mode."
      ],
      "discriminator": [
        104,
        149,
        3,
        136,
        160,
        3,
        13,
        132
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "project",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  106,
                  101,
                  99,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "project.funder",
                "account": "project"
              },
              {
                "kind": "account",
                "path": "project.project_id",
                "account": "project"
              }
            ]
          }
        },
        {
          "name": "authority",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "closeProject",
      "docs": [
        "Close a project (Completed/Cancelled and the vault holds only its rent reserve): close",
        "project + vault, returning rent to the funder."
      ],
      "discriminator": [
        117,
        209,
        53,
        106,
        93,
        55,
        112,
        49
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "project",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  106,
                  101,
                  99,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "project.funder",
                "account": "project"
              },
              {
                "kind": "account",
                "path": "project.project_id",
                "account": "project"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "project"
              }
            ]
          }
        },
        {
          "name": "funder",
          "docs": [
            "Rent reclaim destination; must == project.funder."
          ],
          "writable": true,
          "relations": [
            "project"
          ]
        },
        {
          "name": "authority",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "createProject",
      "docs": [
        "Create a project: init Project + Vault (both PDAs), status=Active. funder is the initiator & payer."
      ],
      "discriminator": [
        148,
        219,
        181,
        42,
        221,
        114,
        145,
        190
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "project",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  106,
                  101,
                  99,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "funder"
              },
              {
                "kind": "arg",
                "path": "projectId"
              }
            ]
          }
        },
        {
          "name": "vault",
          "docs": [
            "Escrow vault: a program-owned empty account (8-byte discriminator) holding native SOL."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "project"
              }
            ]
          }
        },
        {
          "name": "funder",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "projectId",
          "type": "u64"
        },
        {
          "name": "countryCode",
          "type": {
            "array": [
              "u8",
              2
            ]
          }
        },
        {
          "name": "budget",
          "type": "u64"
        },
        {
          "name": "recommendationHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "ndviThreshold",
          "type": "i64"
        },
        {
          "name": "agentAuthority",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "emergencyWithdraw",
      "docs": [
        "Emergency withdraw (admin only, and only while globally paused): move the vault's above-rent",
        "balance to a recipient."
      ],
      "discriminator": [
        239,
        45,
        203,
        64,
        150,
        73,
        218,
        92
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "project",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  106,
                  101,
                  99,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "project.funder",
                "account": "project"
              },
              {
                "kind": "account",
                "path": "project.project_id",
                "account": "project"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "project"
              }
            ]
          }
        },
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "recipient",
          "docs": [
            "Rescue destination (chosen by admin)."
          ],
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "fundProject",
      "docs": [
        "Fund: anyone can contribute. Transfers `amount` into the vault via system transfer,",
        "init_if_needed the contributor's Contribution and accumulates it, and bumps total_funded."
      ],
      "discriminator": [
        129,
        115,
        149,
        68,
        159,
        207,
        33,
        149
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "project",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  106,
                  101,
                  99,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "project.funder",
                "account": "project"
              },
              {
                "kind": "account",
                "path": "project.project_id",
                "account": "project"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "project"
              }
            ]
          }
        },
        {
          "name": "contribution",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  116,
                  114,
                  105,
                  98,
                  117,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "project"
              },
              {
                "kind": "account",
                "path": "contributor"
              }
            ]
          }
        },
        {
          "name": "contributor",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initializeConfig",
      "docs": [
        "Initialize the global Config (seeds=[\"config\"]). The caller becomes admin."
      ],
      "discriminator": [
        208,
        127,
        21,
        1,
        194,
        190,
        196,
        70
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "feeBps",
          "type": "u16"
        },
        {
          "name": "feeTreasury",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "refund",
      "docs": [
        "Refund (when Cancelled): return the contributor's proportional share of the vault funds not",
        "yet released. Permissionless: anyone can trigger it, but funds only go to the recorded contributor."
      ],
      "discriminator": [
        2,
        96,
        183,
        251,
        63,
        208,
        46,
        46
      ],
      "accounts": [
        {
          "name": "project",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  106,
                  101,
                  99,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "project.funder",
                "account": "project"
              },
              {
                "kind": "account",
                "path": "project.project_id",
                "account": "project"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "project"
              }
            ]
          }
        },
        {
          "name": "contribution",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  116,
                  114,
                  105,
                  98,
                  117,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "project"
              },
              {
                "kind": "account",
                "path": "contributor"
              }
            ]
          }
        },
        {
          "name": "contributor",
          "docs": [
            "Refund destination wallet; must == contribution.contributor (enforced by has_one)."
          ],
          "writable": true,
          "relations": [
            "contribution"
          ]
        },
        {
          "name": "payer",
          "docs": [
            "Permissionless: anyone can pay the fee to trigger the refund."
          ],
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "release",
      "docs": [
        "Release: agent_authority only. After the full validation chain, split off the fee and move",
        "lamports directly to the beneficiary and fee_treasury."
      ],
      "discriminator": [
        253,
        249,
        15,
        206,
        28,
        127,
        193,
        241
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "project",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  106,
                  101,
                  99,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "project.funder",
                "account": "project"
              },
              {
                "kind": "account",
                "path": "project.project_id",
                "account": "project"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "project"
              }
            ]
          }
        },
        {
          "name": "agentAuthority",
          "signer": true,
          "relations": [
            "project"
          ]
        },
        {
          "name": "beneficiary",
          "writable": true
        },
        {
          "name": "feeTreasury",
          "docs": [
            "Protocol fee recipient; must == config.fee_treasury (enforced by has_one)."
          ],
          "writable": true,
          "relations": [
            "config"
          ]
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "ndviDelta",
          "type": "i64"
        }
      ]
    },
    {
      "name": "setBeneficiary",
      "docs": [
        "Set the beneficiary (agent_authority only, Active and not paused)."
      ],
      "discriminator": [
        10,
        81,
        219,
        4,
        237,
        149,
        57,
        242
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "project",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  106,
                  101,
                  99,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "project.funder",
                "account": "project"
              },
              {
                "kind": "account",
                "path": "project.project_id",
                "account": "project"
              }
            ]
          }
        },
        {
          "name": "agentAuthority",
          "signer": true,
          "relations": [
            "project"
          ]
        }
      ],
      "args": [
        {
          "name": "beneficiary",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "setPaused",
      "docs": [
        "Set the global pause switch (admin only)."
      ],
      "discriminator": [
        91,
        60,
        125,
        192,
        176,
        225,
        166,
        218
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "config"
          ]
        }
      ],
      "args": [
        {
          "name": "paused",
          "type": "bool"
        }
      ]
    },
    {
      "name": "updateConfig",
      "docs": [
        "Update fee_bps / fee_treasury / admin (admin only). None means \"leave unchanged\"."
      ],
      "discriminator": [
        29,
        158,
        252,
        191,
        10,
        83,
        219,
        99
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "config"
          ]
        }
      ],
      "args": [
        {
          "name": "feeBps",
          "type": {
            "option": "u16"
          }
        },
        {
          "name": "feeTreasury",
          "type": {
            "option": "pubkey"
          }
        },
        {
          "name": "newAdmin",
          "type": {
            "option": "pubkey"
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "config",
      "discriminator": [
        155,
        12,
        170,
        224,
        30,
        250,
        204,
        130
      ]
    },
    {
      "name": "contribution",
      "discriminator": [
        182,
        187,
        14,
        111,
        72,
        167,
        242,
        212
      ]
    },
    {
      "name": "project",
      "discriminator": [
        205,
        168,
        189,
        202,
        181,
        247,
        142,
        19
      ]
    },
    {
      "name": "vault",
      "discriminator": [
        211,
        8,
        232,
        43,
        2,
        152,
        117,
        119
      ]
    }
  ],
  "events": [
    {
      "name": "beneficiarySet",
      "discriminator": [
        182,
        222,
        28,
        46,
        241,
        113,
        214,
        75
      ]
    },
    {
      "name": "configInitialized",
      "discriminator": [
        181,
        49,
        200,
        156,
        19,
        167,
        178,
        91
      ]
    },
    {
      "name": "configUpdated",
      "discriminator": [
        40,
        241,
        230,
        122,
        11,
        19,
        198,
        194
      ]
    },
    {
      "name": "emergencyWithdrawn",
      "discriminator": [
        116,
        226,
        36,
        3,
        37,
        92,
        138,
        76
      ]
    },
    {
      "name": "fundsDeposited",
      "discriminator": [
        157,
        209,
        100,
        95,
        59,
        100,
        3,
        68
      ]
    },
    {
      "name": "fundsRefunded",
      "discriminator": [
        217,
        198,
        91,
        53,
        188,
        223,
        200,
        219
      ]
    },
    {
      "name": "fundsReleased",
      "discriminator": [
        178,
        119,
        252,
        230,
        131,
        104,
        210,
        210
      ]
    },
    {
      "name": "pausedSet",
      "discriminator": [
        171,
        125,
        127,
        156,
        233,
        81,
        68,
        66
      ]
    },
    {
      "name": "projectCancelled",
      "discriminator": [
        243,
        51,
        59,
        74,
        192,
        234,
        193,
        146
      ]
    },
    {
      "name": "projectClosed",
      "discriminator": [
        99,
        119,
        201,
        52,
        106,
        26,
        76,
        87
      ]
    },
    {
      "name": "projectCreated",
      "discriminator": [
        192,
        10,
        163,
        29,
        185,
        31,
        67,
        168
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorized",
      "msg": "Signer is not authorized for this action"
    },
    {
      "code": 6001,
      "name": "notAdmin",
      "msg": "Signer is not the protocol admin"
    },
    {
      "code": 6002,
      "name": "paused",
      "msg": "Protocol is paused"
    },
    {
      "code": 6003,
      "name": "invalidStatus",
      "msg": "Invalid project status for this action"
    },
    {
      "code": 6004,
      "name": "exceedsBudget",
      "msg": "Release would exceed the project budget"
    },
    {
      "code": 6005,
      "name": "impactTooLow",
      "msg": "NDVI delta is below the required threshold"
    },
    {
      "code": 6006,
      "name": "beneficiaryNotSet",
      "msg": "Beneficiary has not been set"
    },
    {
      "code": 6007,
      "name": "invalidBeneficiary",
      "msg": "Beneficiary account does not match or is invalid"
    },
    {
      "code": 6008,
      "name": "insufficientVaultFunds",
      "msg": "Vault has insufficient funds above the rent reserve"
    },
    {
      "code": 6009,
      "name": "invalidAmount",
      "msg": "Amount must be greater than zero"
    },
    {
      "code": 6010,
      "name": "alreadyRefunded",
      "msg": "This contribution has already been refunded"
    },
    {
      "code": 6011,
      "name": "nothingToRefund",
      "msg": "Nothing available to refund"
    },
    {
      "code": 6012,
      "name": "mathOverflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6013,
      "name": "invalidFeeBps",
      "msg": "Fee basis points exceed the allowed maximum"
    },
    {
      "code": 6014,
      "name": "vaultNotEmpty",
      "msg": "Vault still holds escrowed funds"
    }
  ],
  "types": [
    {
      "name": "beneficiarySet",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "project",
            "type": "pubkey"
          },
          {
            "name": "beneficiary",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "config",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "feeBps",
            "type": "u16"
          },
          {
            "name": "feeTreasury",
            "type": "pubkey"
          },
          {
            "name": "paused",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "configInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "feeBps",
            "type": "u16"
          },
          {
            "name": "feeTreasury",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "configUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "feeBps",
            "type": "u16"
          },
          {
            "name": "feeTreasury",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "contribution",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "contributor",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "refunded",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "emergencyWithdrawn",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "project",
            "type": "pubkey"
          },
          {
            "name": "recipient",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "fundsDeposited",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "project",
            "type": "pubkey"
          },
          {
            "name": "contributor",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "totalFunded",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "fundsRefunded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "project",
            "type": "pubkey"
          },
          {
            "name": "contributor",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "fundsReleased",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "project",
            "type": "pubkey"
          },
          {
            "name": "beneficiary",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "fee",
            "type": "u64"
          },
          {
            "name": "ndviDelta",
            "type": "i64"
          },
          {
            "name": "releasedTotal",
            "type": "u64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "projectStatus"
              }
            }
          }
        ]
      }
    },
    {
      "name": "pausedSet",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "paused",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "project",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "funder",
            "type": "pubkey"
          },
          {
            "name": "agentAuthority",
            "type": "pubkey"
          },
          {
            "name": "beneficiary",
            "type": "pubkey"
          },
          {
            "name": "projectId",
            "type": "u64"
          },
          {
            "name": "countryCode",
            "type": {
              "array": [
                "u8",
                2
              ]
            }
          },
          {
            "name": "budget",
            "type": "u64"
          },
          {
            "name": "totalFunded",
            "type": "u64"
          },
          {
            "name": "released",
            "type": "u64"
          },
          {
            "name": "recommendationHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "ndviThreshold",
            "type": "i64"
          },
          {
            "name": "lastNdviDelta",
            "type": "i64"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "updatedAt",
            "type": "i64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "projectStatus"
              }
            }
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "vaultBump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "projectCancelled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "project",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "projectClosed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "project",
            "type": "pubkey"
          },
          {
            "name": "funder",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "projectCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "project",
            "type": "pubkey"
          },
          {
            "name": "funder",
            "type": "pubkey"
          },
          {
            "name": "agentAuthority",
            "type": "pubkey"
          },
          {
            "name": "budget",
            "type": "u64"
          },
          {
            "name": "countryCode",
            "type": {
              "array": [
                "u8",
                2
              ]
            }
          },
          {
            "name": "recommendationHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "ndviThreshold",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "projectStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "active"
          },
          {
            "name": "completed"
          },
          {
            "name": "cancelled"
          }
        ]
      }
    },
    {
      "name": "vault",
      "docs": [
        "Program-owned vault: empty account that only holds lamports."
      ],
      "type": {
        "kind": "struct",
        "fields": []
      }
    }
  ]
};
